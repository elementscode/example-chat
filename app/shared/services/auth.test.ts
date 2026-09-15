import { test, assert, equal, sql } from "@elements/app";
import { userNameFromEmail } from "./auth";

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
