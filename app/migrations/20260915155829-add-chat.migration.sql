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
  ('general', 'Company-wide announcements and work-based matters'),
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
  ('radia@example.com',     'radia',     crypt(gen_random_uuid()::text, genSalt('bf', 10)));

-- A conversation that already has a yesterday, so a fresh install opens on a
-- feed with day dividers and runs of messages grouped under one author.
insert into chatMessages (roomId, userId, userName, body, createdAt)
select r.id, u.id, u.userName, seed.body, now() - seed.ago
from (values
  ('general',     'grace',     'Morning all. Standup notes are up.',                       interval '1 day 6 hours'),
  ('general',     'grace',     'Short version: the migration landed clean overnight.',     interval '1 day 5 hours 58 minutes'),
  ('general',     'alan',      'Nice. Any fallout on the read path?',                      interval '1 day 5 hours 40 minutes'),
  ('general',     'grace',     'None so far. Latency is flat.',                            interval '1 day 5 hours 31 minutes'),
  ('general',     'katherine', 'I pulled the numbers this morning, they hold up.',         interval '1 day 4 hours'),
  ('general',     'radia',     'Welcome aboard to everyone who joined this week.',         interval '7 hours'),
  ('general',     'radia',     'Introduce yourself in here whenever you get a minute.',    interval '6 hours 58 minutes'),
  ('general',     'alan',      'Will do. Glad to be here.',                                interval '5 hours'),
  ('engineering', 'alan',      'Pushed the retry backoff change, please take a look.',     interval '1 day 2 hours'),
  ('engineering', 'katherine', 'Reading it now.',                                          interval '1 day 1 hour 50 minutes'),
  ('engineering', 'katherine', 'One question on the jitter bounds, left it inline.',       interval '1 day 1 hour 48 minutes'),
  ('engineering', 'alan',      'Good catch, tightened it and pushed again.',               interval '3 hours'),
  ('design',      'katherine', 'New type scale is in. Everything steps off one ramp now.', interval '9 hours'),
  ('design',      'grace',     'The headings finally feel related to the body copy.',      interval '8 hours 30 minutes'),
  ('design',      'radia',     'Agreed. Shipping it.',                                     interval '2 hours'),
  ('random',      'radia',     'Someone left a very good bug on my desk. It was a moth.',  interval '4 hours'),
  ('random',      'grace',     'That is the origin story, yes.',                           interval '3 hours 40 minutes')
) as seed(room, author, body, ago)
join chatRooms r on r.name = seed.room
join users u on u.userName = seed.author;
