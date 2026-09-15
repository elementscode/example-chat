import { sql, session, AuthError, ValidationError } from "@elements/app";

interface User {
  id: string;
  email: string;
  userName: string;
}

/**
 * The display name for an account is the part of the email before the '@'.
 */
export function userNameFromEmail(email: string): string {
  return email.trim().toLowerCase().split("@")[0];
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validate(email: string, password: string) {
  let addr = normalizeEmail(email);
  let [local, domain, ...rest] = addr.split("@");

  if (!local || !domain || rest.length > 0 || !domain.includes(".")) {
    throw new ValidationError("enter a valid email address");
  }

  if (password.length < 8) {
    throw new ValidationError("password must be at least 8 characters");
  }

  return addr;
}

/** @rpc */
export function signinUser(email: string, password: string) {
  let addr = normalizeEmail(email);

  let user = sql<User>(
    `select id, email, userName from users
     where email = ${addr}
       and passwordHash = crypt(${password}, passwordHash)`,
  ).first();

  if (!user) {
    throw new AuthError("that email and password do not match");
  }

  session.login({ userId: user.id, userName: user.userName });
}

/** @rpc */
export function signupUser(email: string, password: string) {
  let addr = validate(email, password);

  let taken = sql<{ id: string }>(
    `select id from users where email = ${addr}`,
  ).first();

  if (taken) {
    throw new AuthError("an account with that email already exists");
  }

  let userName = userNameFromEmail(addr);

  let user = sql<{ id: string }>(
    `insert into users (email, userName, passwordHash)
     values (${addr}, ${userName}, crypt(${password}, genSalt('bf', 12)))
     returning id`,
  ).firstOrThrow();

  session.login({ userId: user.id, userName });
}

/** @rpc */
export function logoutUser() {
  session.logout();
}
