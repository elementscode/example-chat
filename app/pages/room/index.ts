import { Request, Response, sql } from "@elements/app";
import html from "./template";
import { Room, chatRooms, chatMessages } from "#app/shared/services/chat";

// Open to anyone. An anonymous visitor reads the channel and posts under a
// guest name; see joinAsGuest in the auth service.
export default function route(req: Request, res: Response) {
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
