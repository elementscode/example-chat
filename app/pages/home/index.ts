import { Request, Response, sql, session, redirect } from "@elements/app";

/**
 * The workspace root. Signed out goes to signin; signed in opens the oldest
 * channel, which is #general on a fresh install.
 */
export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    return redirect("/signin");
  }

  let first = sql<{ id: string }>(
    `select id from chatRooms order by createdAt limit 1`,
  ).firstOrThrow("no channels exist");

  return redirect(`/rooms/${first.id}`);
}
