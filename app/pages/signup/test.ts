import { test, assert, equal, sql, session, AuthError, ValidationError } from "@elements/app";
import { signupUser } from "#app/shared/services/auth";

async function expectThrow(fn: () => void | Promise<void>, kind: any, what: string) {
  let threw = false;

  try {
    await fn();
  } catch (err) {
    threw = true;
    assert(err instanceof kind, `${what}: got ${err}`);
  }

  assert(threw, what);
}

test("signup", () => {
  test("creates an account and names it after the email", () => {
    signupUser("Ada.Lovelace@Example.com", "a-good-passphrase");

    let row = sql<{ email: string; userName: string }>(
      `select email, userName from users where userName = 'ada.lovelace'`,
    ).firstOrThrow();

    equal(row.email, "ada.lovelace@example.com", "the email is normalized");
    equal(row.userName, "ada.lovelace");
    equal(session.get("userName"), "ada.lovelace", "signup signs you in");
  });

  test("never stores the password in the clear", () => {
    signupUser("ada@example.com", "a-good-passphrase");

    let row = sql<{ passwordHash: string }>(
      `select passwordHash from users where email = 'ada@example.com'`,
    ).firstOrThrow();

    assert(!row.passwordHash.includes("a-good-passphrase"));
    assert(row.passwordHash.startsWith("$2"), "expected a bcrypt hash");
  });

  test("rejects a short password", () => {
    expectThrow(
      () => signupUser("short@example.com", "tiny"),
      ValidationError,
      "a password under 8 characters should be refused",
    );

    equal(
      sql<{ n: number }>(`select count(*) as n from users where email = 'short@example.com'`)
        .firstOrThrow().n,
      0,
      "no row should be written for a refused signup",
    );
  });

  test("rejects a malformed email", () => {
    expectThrow(
      () => signupUser("not-an-email", "a-good-passphrase"),
      ValidationError,
      "an address with no domain should be refused",
    );
  });

  test("rejects an email that is already taken", () => {
    signupUser("ada@example.com", "a-good-passphrase");

    expectThrow(
      () => signupUser("ada@example.com", "another-passphrase"),
      AuthError,
      "a duplicate signup should be refused",
    );
  });
});
