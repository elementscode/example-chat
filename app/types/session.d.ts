/**
 * The keys your app stores in the session, so `session.get("userId")` is
 * typed. Add, rename, or remove them to match what you pass to
 * `session.login()`.
 */
declare module "@elements/app" {
  interface SessionData {
    userId: string;
    userName: string;
    /** Set on a visitor who posted before signing up. */
    isGuest?: boolean;
  }
}

export {};
