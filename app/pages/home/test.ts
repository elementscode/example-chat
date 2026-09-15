import { test, assert, equal, sql, session, AuthError, ValidationError } from "@elements/app";
import { createRoom, channelSlug } from "#app/shared/services/chat";

test("home", () => {
  test("a fresh install has a channel to open on", () => {
    let first = sql<{ name: string }>(
      `select name from chatRooms order by createdAt limit 1`,
    ).firstOrThrow("the root route redirects here, so it must exist");

    equal(first.name, "general");
  });

  test("an anonymous visitor cannot create a channel", () => {
    let threw = false;

    try {
      createRoom("secret", "");
    } catch (err) {
      threw = true;
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(threw, "an anonymous create should be refused");

    equal(
      sql<{ n: number }>(`select count(*) as n from chatRooms where name = 'secret'`)
        .firstOrThrow().n,
      0,
    );
  });

  test("a signed in user creates a channel under a slug", () => {
    session.login({ userId: "00000000-0000-7000-8000-000000000000", userName: "tester" });

    let id = createRoom("Launch Plan", "shipping in march");

    let row = sql<{ name: string; topic: string }>(
      `select name, topic from chatRooms where id = ${id}`,
    ).firstOrThrow();

    equal(row.name, channelSlug("Launch Plan"));
    equal(row.name, "launch-plan");
    equal(row.topic, "shipping in march");
  });

  test("a channel name that slugifies to nothing is refused", () => {
    session.login({ userId: "00000000-0000-7000-8000-000000000000", userName: "tester" });

    let threw = false;

    try {
      createRoom("!!!", "");
    } catch (err) {
      threw = true;
      assert(err instanceof ValidationError, `got ${err}`);
    }

    assert(threw, "an empty slug should be refused");
  });

  test("two channels cannot share a name", () => {
    session.login({ userId: "00000000-0000-7000-8000-000000000000", userName: "tester" });

    let threw = false;

    try {
      createRoom("General", "");
    } catch (err) {
      threw = true;
      assert(err instanceof ValidationError, `got ${err}`);
    }

    assert(threw, "#general already exists, so this should be refused");
  });
});
