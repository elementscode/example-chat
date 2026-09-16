import { test, assert, equal, sql, session, AuthError } from "@elements/app";
import { joinAsGuest, signinUser, userNameFromEmail } from "./auth";

test("auth", () => {
  test("userName is the local part of the email", () => {
    equal(userNameFromEmail("ada@realchat.dev"), "ada");
    equal(userNameFromEmail("Grace.Hopper@Navy.MIL"), "grace.hopper");
    equal(userNameFromEmail("  alan@turing.org  "), "alan");
  });

  test("password stores as a bcrypt hash, never plaintext", () => {
    let row = sql<{ passwordHash: string }>(
      `insert into users (email, userName, passwordHash)
       values ('ada@realchat.dev', 'ada', crypt('correct horse', genSalt('bf', 4)))
       returning passwordHash`,
    ).firstOrThrow();

    assert(!row.passwordHash.includes("correct horse"));
    assert(row.passwordHash.startsWith("$2"));
  });

  test("the right password verifies and the wrong one does not", () => {
    sql(
      `insert into users (email, userName, passwordHash)
       values ('ada@realchat.dev', 'ada', crypt('correct horse', genSalt('bf', 4)))`,
    );

    let ok = sql<{ id: string }>(
      `select id from users
       where email = 'ada@realchat.dev'
         and passwordHash = crypt('correct horse', passwordHash)`,
    ).first();

    let bad = sql<{ id: string }>(
      `select id from users
       where email = 'ada@realchat.dev'
         and passwordHash = crypt('wrong horse', passwordHash)`,
    ).first();

    assert(ok !== undefined, "the correct password should verify");
    assert(bad === undefined, "the wrong password should not verify");
  });

  test("a visitor joins as a guest and gets a session", () => {
    assert(!session.isLoggedIn(), "the test starts anonymous");

    joinAsGuest();

    assert(session.isLoggedIn(), "joining should open a session");
    assert(session.get("isGuest") === true, "the session should be marked a guest");

    let name = session.getOrThrow("userName");

    assert(name.startsWith("guest-"), `got ${name}`);

    let row = sql<{ userName: string }>(
      `select userName from users where id = ${session.getOrThrow("userId")}`,
    ).firstOrThrow("a guest is backed by a real users row");

    equal(row.userName, name);
  });

  test("joining twice keeps the identity you already have", () => {
    joinAsGuest();

    let first = session.getOrThrow("userId");

    joinAsGuest();

    equal(session.getOrThrow("userId"), first, "a second join should be a no-op");

    equal(
      sql<{ n: number }>(`select count(*) as n from users where email like '%@guest.invalid'`)
        .firstOrThrow().n,
      1,
    );
  });

  test("a guest row is not an account anyone can sign in to", () => {
    joinAsGuest();

    let guest = sql<{ email: string }>(
      `select email from users where id = ${session.getOrThrow("userId")}`,
    ).firstOrThrow();

    for (let attempt of ["", "password", "guest", guest.email]) {
      let threw = false;

      try {
        signinUser(guest.email, attempt);
      } catch (err) {
        threw = true;
        assert(err instanceof AuthError, `got ${err}`);
      }

      assert(threw, `signing in as a guest with "${attempt}" should be refused`);
    }
  });

  test("email is unique", () => {
    sql(
      `insert into users (email, userName, passwordHash)
       values ('ada@realchat.dev', 'ada', crypt('x', genSalt('bf', 4)))`,
    );

    let count = sql<{ n: number }>(
      `select count(*) as n from users where email = 'ada@realchat.dev'`,
    ).firstOrThrow();

    equal(count.n, 1);
  });
});
