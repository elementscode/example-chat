import { test, assert, equal, sql, session, AuthError } from "@elements/app";
import { signinUser, signupUser, logoutUser } from "#app/shared/services/auth";

test("signin", () => {
  test("signs in with the right password", () => {
    signupUser("ada@example.com", "a-good-passphrase");
    logoutUser();

    signinUser("ada@example.com", "a-good-passphrase");

    assert(session.isLoggedIn());
    equal(session.get("userName"), "ada");
  });

  test("the email is not case sensitive", () => {
    signupUser("ada@example.com", "a-good-passphrase");
    logoutUser();

    signinUser("  Ada@Example.COM  ", "a-good-passphrase");

    assert(session.isLoggedIn());
  });

  test("refuses the wrong password", () => {
    signupUser("ada@example.com", "a-good-passphrase");
    logoutUser();

    let threw = false;

    try {
      signinUser("ada@example.com", "not-the-passphrase");
    } catch (err) {
      threw = true;
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(threw, "the wrong password should be refused");
    assert(!session.isLoggedIn(), "a refused signin must not create a session");
  });

  test("refuses an unknown email", () => {
    let threw = false;

    try {
      signinUser("nobody@example.com", "a-good-passphrase");
    } catch (err) {
      threw = true;
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(threw, "an unknown account should be refused");
  });

  test("the seeded demo accounts cannot be signed into", () => {
    let threw = false;

    try {
      signinUser("grace@example.com", "realchat-demo");
    } catch (err) {
      threw = true;
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(threw, "seeded accounts must hold no usable credential");
  });
});
