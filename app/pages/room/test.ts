import { test, assert, equal, sql, session, AuthError } from "@elements/app";
import { chatMessages, Message } from "#app/shared/services/chat";
import { joinAsGuest } from "#app/shared/services/auth";

function seedUser(name: string): string {
  return sql<{ id: string }>(
    `insert into users (email, userName, passwordHash)
     values (${name + "@example.test"}, ${name}, crypt('x', genSalt('bf', 4)))
     returning id`,
  ).firstOrThrow().id;
}

function roomId(name: string): string {
  return sql<{ id: string }>(
    `select id from chatRooms where name = ${name}`,
  ).firstOrThrow().id;
}

function post(room: string, userId: string, userName: string, body: string) {
  chatMessages.view({ roomId: roomId(room) }).insert({ userId, userName, body });
}

test("room", () => {
  // The page is open to anyone, but a write still needs a session. The
  // composer calls joinAsGuest() before it inserts, so a visitor who never
  // signs up posts under a guest name rather than under nothing at all.
  test("a post with no session at all is refused", () => {
    let threw = false;

    try {
      post("general", "00000000-0000-7000-8000-000000000000", "nobody", "nope");
    } catch (err) {
      threw = true;
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(threw, "an anonymous insert should be refused");
  });

  test("a signed in user can post", () => {
    let id = seedUser("poster");
    session.login({ userId: id, userName: "poster" });

    post("general", id, "poster", "hello from a test");

    let row = sql<{ body: string }>(
      `select body from chatMessages where userId = ${id}`,
    ).firstOrThrow();

    equal(row.body, "hello from a test");
  });

  test("a guest posts without signing up", () => {
    joinAsGuest();

    let userId = session.getOrThrow("userId");
    let userName = session.getOrThrow("userName");

    post("general", userId, userName, "hello from a guest");

    let row = sql<{ body: string; userName: string }>(
      `select body, userName from chatMessages where userId = ${userId}`,
    ).firstOrThrow();

    equal(row.body, "hello from a guest");
    equal(row.userName, userName);
  });

  test("a guest can delete the message they posted", () => {
    joinAsGuest();

    let userId = session.getOrThrow("userId");
    let room = roomId("general");

    post("general", userId, session.getOrThrow("userName"), "mine, briefly");

    let row = sql<Message>(
      `select id, createdAt, roomId, userId, userName, body
       from chatMessages where userId = ${userId}`,
    ).firstOrThrow();

    chatMessages.view({ roomId: room }).delete(row);

    equal(
      sql<{ n: number }>(`select count(*) as n from chatMessages where id = ${row.id}`)
        .firstOrThrow().n,
      0,
    );
  });

  test("a message lands only in the channel it was posted to", () => {
    let id = seedUser("poster");
    session.login({ userId: id, userName: "poster" });

    post("design", id, "poster", "design only");

    let here = sql<{ n: number }>(
      `select count(*) as n from chatMessages
       where userId = ${id} and roomId = ${roomId("design")}`,
    ).firstOrThrow();

    let there = sql<{ n: number }>(
      `select count(*) as n from chatMessages
       where userId = ${id} and roomId = ${roomId("random")}`,
    ).firstOrThrow();

    equal(here.n, 1);
    equal(there.n, 0);
  });

  test("you cannot delete someone else's message", () => {
    let mine = seedUser("mine");
    let theirs = seedUser("theirs");
    let room = roomId("general");

    session.login({ userId: theirs, userName: "theirs" });
    post("general", theirs, "theirs", "not yours to delete");

    let row = sql<Message>(
      `select id, createdAt, roomId, userId, userName, body
       from chatMessages where userId = ${theirs}`,
    ).firstOrThrow();

    session.login({ userId: mine, userName: "mine" });

    let threw = false;

    try {
      chatMessages.view({ roomId: room }).delete(row);
    } catch (err) {
      threw = true;
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(threw, "deleting another user's message should be refused");

    let left = sql<{ n: number }>(
      `select count(*) as n from chatMessages where id = ${row.id}`,
    ).firstOrThrow();

    equal(left.n, 1, "the message must survive a refused delete");
  });

  test("you can delete your own message", () => {
    let id = seedUser("owner");
    let room = roomId("general");

    session.login({ userId: id, userName: "owner" });
    post("general", id, "owner", "mine to remove");

    let row = sql<Message>(
      `select id, createdAt, roomId, userId, userName, body
       from chatMessages where userId = ${id}`,
    ).firstOrThrow();

    chatMessages.view({ roomId: room }).delete(row);

    let left = sql<{ n: number }>(
      `select count(*) as n from chatMessages where id = ${row.id}`,
    ).firstOrThrow();

    equal(left.n, 0);
  });
});
