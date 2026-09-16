-- add chat

-- Auto-update updatedAt on row changes.
create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

create table users (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  userName text not null,
  passwordHash text not null
);

create trigger usersTouchUpdatedAt
  before update on users
  for each row execute function touchUpdatedAt();

create table chatRooms (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  name text not null unique,
  topic text not null default ''
);

create trigger chatRoomsTouchUpdatedAt
  before update on chatRooms
  for each row execute function touchUpdatedAt();

-- Every browser watching the sidebar listens on one unpartitioned channel, so
-- a channel created by an rpc, a job, or `elements db` reaches all of them.
-- The name here must match the one the chatRooms LiveTable declares.
create or replace function chatRoomsNotify() returns trigger
language plpgsql as $$
declare
  r record;
begin
  r := coalesce(new, old);

  perform pg_notify(
    channel_name('chatRooms'),
    json_build_object(
      'op', lower(tg_op),
      'data', json_build_object(
        'id', r.id,
        'createdAt', json_build_object('$type', 'Date', '$value', (extract(epoch from r.createdAt) * 1000)::bigint),
        'name', r.name,
        'topic', r.topic
      )
    )::text
  );

  return r;
end;
$$;

create trigger chatRoomsNotifyTrigger
  after insert or update or delete on chatRooms
  for each row execute function chatRoomsNotify();

create table chatMessages (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  roomId uuid not null references chatRooms(id) on delete cascade,
  userId uuid not null references users(id) on delete cascade,
  userName text not null,
  body text not null
);

create index chatMessagesRoomIdIdx on chatMessages (roomId);

create trigger chatMessagesTouchUpdatedAt
  before update on chatMessages
  for each row execute function touchUpdatedAt();

-- Broadcast writes that do not come from a live view, so a message inserted by
-- a job, an rpc, or `elements db -c` still reaches every open page.
create or replace function chatMessagesNotify() returns trigger
language plpgsql as $$
declare
  r record;
begin
  r := coalesce(new, old);

  perform pg_notify(
    channel_name('chatMessages:roomId=' || r.roomId),
    json_build_object(
      'op', lower(tg_op),
      'data', json_build_object(
        'id', r.id,
        'createdAt', json_build_object('$type', 'Date', '$value', (extract(epoch from r.createdAt) * 1000)::bigint),
        'roomId', r.roomId,
        'userId', r.userId,
        'userName', r.userName,
        'body', r.body
      )
    )::text
  );

  return r;
end;
$$;

create trigger chatMessagesNotifyTrigger
  after insert or update or delete on chatMessages
  for each row execute function chatMessagesNotify();

-- Seed the rooms every new install opens with.
insert into chatRooms (name, topic) values
  ('general', 'Announcements, and anything everyone should see'),
  ('design', 'Type, color, and pixel arguments'),
  ('engineering', 'Ships, bugs, and postmortems'),
  ('random', 'Non-work banter and links');

-- The people in the sample conversation below.
--
-- Their passwords are a random uuid hashed at migration time, so no one holds
-- a credential for these rows and none of them can sign in. That is
-- deliberate: this app ships as a scaffold, and a seeded account with a known
-- password would reach production the first time someone deploys what they
-- built on it. Sign up for your own account to join the conversation.
insert into users (email, userName, passwordHash) values
  ('grace@example.com',     'grace',     crypt(gen_random_uuid()::text, genSalt('bf', 10))),
  ('alan@example.com',      'alan',      crypt(gen_random_uuid()::text, genSalt('bf', 10))),
  ('katherine@example.com', 'katherine', crypt(gen_random_uuid()::text, genSalt('bf', 10))),
  ('radia@example.com',     'radia',     crypt(gen_random_uuid()::text, genSalt('bf', 10))),
  ('margaret@example.com',  'margaret',  crypt(gen_random_uuid()::text, genSalt('bf', 10))),
  ('barbara@example.com',   'barbara',   crypt(gen_random_uuid()::text, genSalt('bf', 10))),
  ('edsger@example.com',    'edsger',    crypt(gen_random_uuid()::text, genSalt('bf', 10)));

-- A conversation that already has a yesterday, so a fresh install opens on a
-- feed with day dividers and runs of messages grouped under one author.
--
-- It is also the first thing anyone reads, so the team is talking about the
-- thing they are standing in: one question, one answer, one capability. Keep
-- every line true of what Elements actually does, keep it plain text (the feed
-- renders a body verbatim, so backticks and asterisks arrive as characters),
-- and keep prices out of it. Name a category of tool, never another product,
-- and never a line of the form "no <product name>". Nobody moved to Elements
-- or migrated onto it: they are building, and nothing else ever existed.
--
-- Write the way an adult writes to a colleague. Never "that is the whole app",
-- never "the whole story", never "it is not x, it is y", and no "whole" or
-- "the thing" standing in for a noun. Say what it does and stop.
insert into chatMessages (roomId, userId, userName, body, createdAt)
select r.id, u.id, u.userName, seed.body, now() - seed.ago
from (values
  ('general',     'grace',     'Can you believe we built a real time chat app in about five seconds with Elements?',                                   interval '1 day 6 hours'),
  ('general',     'alan',      'Yeah that is crazy. Try typing a message from another browser and see how it appears instantly.',                     interval '1 day 5 hours 58 minutes'),
  ('general',     'katherine', 'The agents ship features in here now and they land working. They read the errors off the build, so they fix what broke instead of guessing.', interval '1 day 5 hours 40 minutes'),
  ('general',     'grace',     'Every save hot reloads the page you already have open, so you watch it get built as it happens.', interval '1 day 5 hours 20 minutes'),
  ('general',     'grace',     'One project server holds the app in memory and rebuilds the moment a file changes. elements build reads what it already has and answers immediately.', interval '1 day 5 hours 18 minutes'),
  ('general',     'barbara',   'The primitives are all in the one package as well. Routes in code, rpc across the wire, sql underneath it, sessions and auth on both sides, live tables, jobs on a cron or a schedule, and email.', interval '1 day 4 hours 40 minutes'),
  ('general',     'barbara',   'I have not added a dependency to do any of it.',                                                                       interval '1 day 4 hours 38 minutes'),
  ('general',     'radia',     'And the pages are reactive html. Typed parameters the compiler checks, rendered on the server, hydrated in the browser, one file for both.', interval '1 day 4 hours 20 minutes'),
  ('general',     'radia',     'This feed is one of those templates. An e:for over the messages is the loop, and it re-renders when a row lands.', interval '1 day 4 hours 18 minutes'),
  ('general',     'katherine', 'Postgres is part of it too, and there is no bundler config, no separate test runner and no deploy pipeline anywhere in here.', interval '1 day 4 hours'),
  ('general',     'radia',     'Welcome to everyone who joined this week. You are reading this in the app itself, not a screenshot of one.',            interval '7 hours'),
  ('general',     'radia',     'Say something in the composer below. You do not need an account, you will post as a guest.',                            interval '6 hours 58 minutes'),
  ('general',     'alan',      'Then open app/pages/room/template.html and change a word. The page reloads while you are looking at it.',               interval '5 hours'),
  ('general',     'katherine', 'You can work on an app in a normal editor like VS Code, or completely inside an agent harness like Claude Code or Codex. Same project either way.', interval '4 hours 50 minutes'),
  ('engineering', 'alan',      'Question for whoever wrote the message feed. Where is the websocket code?',                                             interval '1 day 2 hours'),
  ('engineering', 'katherine', 'There isn''t any. It is one live table declaration in app/shared/services/chat.ts.',                                    interval '1 day 1 hour 50 minutes'),
  ('engineering', 'katherine', 'Live tables push every change to every connected browser, and an insert applies optimistically, so your own message lands before the round trip finishes.', interval '1 day 1 hour 48 minutes'),
  ('engineering', 'alan',      'Then where does authorization live?',                                                                                   interval '1 day 1 hour 30 minutes'),
  ('engineering', 'katherine', 'On the declaration, next to the table. Delete checks the message is yours, and it holds no matter which browser asks.', interval '1 day 1 hour 20 minutes'),
  ('engineering', 'alan',      'Good. That is the version I cannot forget to write.',                                                                   interval '1 day 1 hour 10 minutes'),
  ('engineering', 'grace',     'Reminder that calling the server is a function call. Import it, call it, and the types check across the wire. You are not hand writing an endpoint or generating a client.', interval '3 hours'),
  ('engineering', 'grace',     'The sql sits underneath it in the same file, parameterized at build time, so the template literal is never string concatenation.', interval '2 hours 58 minutes'),
  ('engineering', 'margaret',  'Authentication and authorization are baked in and they work. Sessions, sign in, and the check on a write, with nothing third party to wire up.', interval '2 hours 40 minutes'),
  ('engineering', 'margaret',  'They read the same on the server and in the browser too, so I stopped keeping a mental map of which half I was in.', interval '2 hours 38 minutes'),
  ('engineering', 'katherine', 'Migrations are plain sql files it applies as you save. I edited one this morning and it replayed on its own.',        interval '2 hours 30 minutes'),
  ('engineering', 'barbara',   'Jobs run on a cron or a schedule and email sends, out of that same program. There is nothing else to stand up.',        interval '2 hours 15 minutes'),
  ('engineering', 'alan',      'And tests run inside the build, each in a transaction that rolls back, so they never see each other''s writes.',        interval '2 hours'),
  ('engineering', 'alan',      'A red test is a red build. No green build with a broken app behind it.',                                                interval '1 hour 58 minutes'),
  ('engineering', 'edsger',    'The part I did not expect: the process that builds is the language server my editor talks to. One index, one answer.',  interval '1 hour 30 minutes'),
  ('design',      'katherine', 'Everything on this page is @elements/style. Buttons, inputs, avatars, and the layout primitives that space them.',      interval '1 day 5 hours'),
  ('design',      'katherine', 'I have not written a media query and dark mode still works.',                                                           interval '1 day 4 hours 58 minutes'),
  ('design',      'grace',     'The headings finally look related to the body copy. One ramp, no one-off sizes.',                                       interval '1 day 4 hours 30 minutes'),
  ('design',      'radia',     'Reactive html, checked by the same compiler as the TypeScript. Parameters are typed, so a typo in a prop fails the build before you ever load the page.', interval '6 hours'),
  ('design',      'radia',     'It renders on the server and hydrates in the browser. Same file for both.',                                             interval '5 hours 58 minutes'),
  ('design',      'margaret',       'Which is why the first paint already has the messages in it. View source on this page and they are there.',             interval '5 hours 30 minutes'),
  ('random',      'radia',     'Someone left a very good bug on my desk. It was a moth.',                                                               interval '1 day 4 hours'),
  ('random',      'grace',     'That is the origin story, yes.',                                                                                        interval '1 day 3 hours 40 minutes'),
  ('random',      'alan',      'Deploy went out over ssh to a machine we picked. Only the changed files moved, and we were back up in a few hundred milliseconds.', interval '4 hours'),
  ('random',      'katherine', 'I keep waiting for the pipeline stage that never comes.',                                                               interval '3 hours 50 minutes'),
  ('random',      'edsger',    'There isn''t one. It goes from your machine to the server and that is it.',                                                                           interval '3 hours 40 minutes'),
  ('random',      'grace',     'Also the manual is inside the binary. elements man works on a plane, and it matches the version you actually have.',    interval '3 hours 30 minutes')
) as seed(room, author, body, ago)
join chatRooms r on r.name = seed.room
join users u on u.userName = seed.author;
