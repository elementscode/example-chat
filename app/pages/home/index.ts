import { Request, Response, sql, redirect } from "@elements/app";

/**
 * The workspace root. It opens the oldest channel, which is #general on a
 * fresh install. There is no sign in wall: a visitor reads the conversation
 * straight away, and signs up only when they want a name that sticks.
 */
export default function route(req: Request, res: Response) {
  let first = sql<{ id: string }>(
    `select id from chatRooms order by createdAt limit 1`,
  ).firstOrThrow("no channels exist");

  return redirect(`/rooms/${first.id}`);
}
