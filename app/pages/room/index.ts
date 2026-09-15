import { Request, Response, sql, session, redirect } from "@elements/app";
import html from "./template";
import { Room, chatRooms, chatMessages } from "#app/shared/services/chat";

export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    return redirect("/signin");
  }

  let roomId = req.params.id;

  let current = sql<Room>(
    `select id, createdAt, name, topic from chatRooms where id = ${roomId}`,
  ).firstOrThrow("channel not found");

  return new html({
    current,
    rooms: chatRooms.view(),
    messages: chatMessages.view({ roomId }),
  });
}
