# example-chat

A realtime group chat app built with [Elements](https://elements.dev).
Multiple channels, email and password accounts, and a message feed that
stays live in every open browser.

Use it as a scaffold to start your own app, or read it as a worked example
of how the pieces fit together.

## Create an app from it

### Give it to your agent

Paste this into Claude Code, or any agent that can run commands:

```
Create an Elements app from this scaffold:

  elements create chat -scaffold=elementscode/example-chat

Then move your working directory into it, start it with `elements start`
as a tracked background task, and open http://localhost:4000 for me.
Read the AGENTS.md it writes before you change anything.
```

### Or do it yourself

```bash
elements create chat -scaffold=elementscode/example-chat
```

That creates `chat/` in the current directory, with this app's code and
its own fresh project id. Move into it:

```bash
cd chat
```

Start the server:

```bash
elements start
```

Open http://localhost:4000. There is nothing else to install: Elements
brings its own Postgres, build system, test runner and package installer,
and the first build creates and migrates the database for you.

You need Elements installed first; see
[elements.dev](https://elements.dev). The scaffold name accepts any GitHub
spelling (`elementscode/example-chat`, the browser url, the clone url),
and `@ref` pins a branch, tag or commit.

## First run

The app opens on `/signin`. There is no account yet, so follow **Create an
account**: sign up with any email and a password of at least 8 characters.
Your display name is the part of the email before the `@`, so
`you@example.com` becomes `@you`.

You land in `#general`, which already has a conversation in it. That
history is seeded by the migration so a fresh install has something to
look at.

**The seeded people cannot be signed into.** `grace`, `alan`, `katherine`
and `radia` have passwords hashed from a random uuid generated at
migration time, so nobody holds a credential for them. That is
deliberate: a migration runs unchanged on every machine including
production, so a scaffold must never ship an account anyone can log into.
Seed content, never credentials.

To see messages arrive live, open a second browser (a private window is
enough), sign up as someone else, and post from one side while watching
the other.

## What it does

- **Channels.** Four to start. The sidebar creates more; names slugify, so
  "Launch Plan" becomes `#launch-plan`.
- **Accounts.** Separate `/signin` and `/signup` pages, email and password,
  bcrypt hashing at cost 12 inside Postgres.
- **A live feed.** Messages appear in every browser watching that channel,
  with day dividers, runs of messages grouped under one author, and your
  own messages deletable.

## How it is built

Worth reading in this order:

| File | What it shows |
|---|---|
| `app/migrations/*.migration.sql` | The schema, plus a `pg_notify` trigger so writes that bypass the app still reach open pages |
| `app/shared/services/chat.ts` | Two `LiveTable`s, one partitioned per channel, with authorization on the declaration |
| `app/shared/services/auth.ts` | `@rpc` signin and signup; the password is compared inside Postgres and never reaches TypeScript |
| `app/pages/room/index.ts` | A route that guards the session and opens a partitioned view |
| `app/pages/room/template.html` | The feed, the composer, and the reactive template language |
| `app/pages/*/test.ts` | Tests for each page, run as part of the build |

Three things in here are worth copying:

**Authorization lives on the `LiveTable` declaration**, not in the
template. The `delete` handler in `chat.ts` checks ownership, so the rule
holds no matter which browser asks.

**The channel partition is the security boundary.** `chatMessages.view({
roomId })` opens one channel's stream; a browser in another channel never
receives those rows.

**The feed renders from one flat loop.** Each row carries its own day
break and grouping flag (`feedRows()` in `room/template.html`) rather than
nesting a loop inside a per-day group. A nested loop rebuilds every row on
each new message; a flat keyed loop patches just the one that arrived.

## Make it yours

Rename the app in `config.jsoc`:

```jsoc
/** @browser */
public: {
  appName: "Chat",
},
```

Every heading and the sidebar wordmark read that value.

The look comes from `@elements/style` with the Elements blue theme. To
rebrand, repoint the accent tokens in `app/shared/styles/vars.css`; that
file also holds the chat shell's own surfaces.

Clear the sample conversation by deleting the two seed `insert` statements
at the end of the migration, then save. In development Elements replays an
edited migration against your local database.

## Working on it

```bash
elements build -json
```

Run this after every edit. It installs, compiles, migrates, tests and
releases, so a green build is all of that at once.

```bash
elements test -json
```

Tests are part of the build and each runs in a transaction that rolls
back, so they never leave rows behind.

```bash
elements db
```

A psql shell on the development database. Inserting a row here shows up in
an open page immediately, which is the quickest way to see the realtime
path working end to end.

## Deploying

```bash
elements deploy -json
```

Read `elements man deploy` first. You deploy to machines you own over SSH.

## Learning more

```bash
elements man            # every topic
elements man start      # start here
elements man -s chat    # search
```

The patterns in this app are covered by `elements man recipes/chat-rooms`
and `elements man recipes/authentication`.

## License

MIT.
