import { LiveTable, session, sql, AuthError, ValidationError } from "@elements/app";

export interface Room {
  id: string;
  createdAt: Date;
  name: string;
  topic: string;
}

export interface Message {
  id: string;
  createdAt: Date;
  roomId: string;
  userId: string;
  userName: string;
  body: string;
  /** Transient browser-only flag that drives the leave animation. */
  leaving?: boolean;
}

// Opened whole with chatRooms.view(): every browser watches the same channel
// and sees a new channel the moment anyone creates one. The name is pinned
// because the migration's trigger has to notify the same string.
export let chatRooms = new LiveTable<Room>({
  channel: () => "chatRooms",
});

export let chatMessages: LiveTable<Message> = new LiveTable<Message>({
  channel: (partition) =>
    partition ? `chatMessages:${partition}` : "chatMessages",
  insert: (item) => {
    session.isLoggedInOrThrow();
    return chatMessages.insert(item);
  },
  // Authorization lives on the declaration, so it holds no matter which
  // browser asks: you can only delete your own message.
  delete: (item) => {
    if (item.userId !== session.getOrThrow("userId")) {
      throw new AuthError("you can only delete your own messages");
    }

    return chatMessages.delete(item);
  },
});

/**
 * Channel names are lowercase and hyphenated, so "Launch Plan" and
 * "launch plan!" both land on the same #launch-plan.
 */
export function channelSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** @rpc */
export function createRoom(name: string, topic: string): string {
  session.isLoggedInOrThrow();

  let slug = channelSlug(name);

  if (slug.length === 0) {
    throw new ValidationError("channel name is required");
  }

  let taken = sql<{ id: string }>(
    `select id from chatRooms where name = ${slug}`,
  ).first();

  if (taken) {
    throw new ValidationError(`#${slug} already exists`);
  }

  return sql<{ id: string }>(
    `insert into chatRooms (name, topic) values (${slug}, ${topic.trim()}) returning id`,
  ).firstOrThrow().id;
}
