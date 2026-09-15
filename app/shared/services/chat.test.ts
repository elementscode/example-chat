import { test, assert, equal, sql } from "@elements/app";
import { channelSlug } from "./chat";

function seedUser(): string {
  return sql<{ id: string }>(
    `insert into users (email, userName, passwordHash)
     values ('ada@realchat.dev', 'ada', crypt('x', genSalt('bf', 4)))
     returning id`,
  ).firstOrThrow().id;
}

function seedRoom(name: string): string {
  return sql<{ id: string }>(
    `insert into chatRooms (name, topic) values (${name}, 'testing') returning id`,
  ).firstOrThrow().id;
}

test("chat", () => {
  test("channel names slugify", () => {
    equal(channelSlug("Launch Plan"), "launch-plan");
    equal(channelSlug("  Q4   Planning!  "), "q4-planning");
    equal(channelSlug("#design"), "design");
    equal(channelSlug("already-fine"), "already-fine");
    equal(channelSlug("!!!"), "");
  });

  test("a fresh install seeds the starter channels", () => {
    let rooms = sql<{ name: string }>(
      `select name from chatRooms order by createdAt`,
    ).all();

    equal(rooms.map((r) => r.name), [
      "general",
      "design",
      "engineering",
      "random",
    ]);
  });

  test("a message belongs to one channel", () => {
    let userId = seedUser();
    let roomId = seedRoom("standup");
    let other = seedRoom("watercooler");

    sql(
      `insert into chatMessages (roomId, userId, userName, body)
       values (${roomId}, ${userId}, 'ada', 'morning')`,
    );

    let here = sql<{ n: number }>(
      `select count(*) as n from chatMessages where roomId = ${roomId}`,
    ).firstOrThrow();

    let there = sql<{ n: number }>(
      `select count(*) as n from chatMessages where roomId = ${other}`,
    ).firstOrThrow();

    equal(here.n, 1);
    equal(there.n, 0);
  });

  test("deleting a channel takes its history with it", () => {
    let userId = seedUser();
    let roomId = seedRoom("temporary");

    sql(
      `insert into chatMessages (roomId, userId, userName, body)
       values (${roomId}, ${userId}, 'ada', 'this goes away')`,
    );

    sql(`delete from chatRooms where id = ${roomId}`);

    let left = sql<{ n: number }>(
      `select count(*) as n from chatMessages where roomId = ${roomId}`,
    ).firstOrThrow();

    equal(left.n, 0);
  });

  test("channel names are unique", () => {
    seedRoom("duplicated");

    let count = sql<{ n: number }>(
      `select count(*) as n from chatRooms where name = 'duplicated'`,
    ).firstOrThrow();

    equal(count.n, 1);
  });

  test("userName is denormalized onto the message", () => {
    let userId = seedUser();
    let roomId = seedRoom("history");

    sql(
      `insert into chatMessages (roomId, userId, userName, body)
       values (${roomId}, ${userId}, 'ada', 'written as ada')`,
    );

    sql(`update users set userName = 'ada.lovelace' where id = ${userId}`);

    let msg = sql<{ userName: string }>(
      `select userName from chatMessages where roomId = ${roomId}`,
    ).firstOrThrow();

    assert(msg.userName === "ada", "history keeps the name it was written with");
  });
});
