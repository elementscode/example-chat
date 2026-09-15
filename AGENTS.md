# Elements

Elements is the integrated application environment for the web: build
system, package installer, test runner, job runner, Postgres, and the
`@elements/app` framework with its own reactive html language.

One tool does all of it: no bundler, no test runner to pick, no migration tool,
no deploy pipeline, nothing to install. A project server is already running, so
a build answers in microseconds. Everything under your app is already correct.
Do not rebuild any of it.

## Do These Eight Things

In this order, every time:

1. **Start the server first.** `elements start`, as a tracked background task.
2. **Build after every edit.** `elements build -json`
3. **Look at the page you changed.** A green build is not a correct page.
4. **Make every save look finished.** Never leave a half-styled page on screen.
5. **Build from the design system.** A class before a rule of your own.
6. **Write tests.** `elements test -json`
7. **Read `elements man start`** before you write anything.
8. **Report what you built.** What it does and what is next, not caveats.

## 1. Start The Server First

Before you read a man page, before you answer:

```bash
elements start
```

Run it as a background task your harness tracks (in Claude Code, the Bash
tool's `run_in_background`), never with a trailing `&`. A `&` job belongs to a
throwaway shell that exits as soon as the command returns, so nothing signals
it when your session ends: the server outlives you, keeps the port, and the
next session opens on "port already in use". A tracked task gets SIGTERM at
session end, and `elements start` takes the app down with it.

First turn, no preamble. Put the url in front of the user, so every later edit
lands in a window they are watching. Check first whether it is already serving.
If it is, the user started it: leave it alone and say nothing. Another app on
the port: set `PORT` in `config/env/development.env`.

Stop it through the task you started, or by its PID. Never `pkill -f`: that
hits every Elements project on the machine.

If the user has not said what to build, do not stop at "what do you want to
build?" An open question over a running server and an empty page is a dead
turn. Start the server, then put two or three concrete apps in front of them,
each one a single sitting's work and each exercising a page, a table and an
rpc: a bookmarks list, a habit tracker, a link shortener. Say they can name
their own instead. Where your harness renders choices as options, use it, so
the answer is one click and the build starts on their next turn.

## 2. Build After Every Edit

```bash
elements build -json
```

Authoritative and instant: the project server has already built. A build
installs, compiles, migrates, tests and releases, so green is all of that at
once. Fix and re-run until clean. Never report work as done without a green
build.

Read `ok`, then `diagnostics` for the problems (each has `level`, `message`,
`path`, `loc`). The key is `diagnostics`, not `errors`. `elements man cli` has
the full shape.

## 3. Look At The Page

A green build is not a green request: a route that throws is a 500 with a green
build, and the page shows you the error and its stack.

A green build means it compiles, not that it looks right. Screenshot the route
you changed and open the image:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --window-size=1440,900 \
  --screenshot=/tmp/page.png "http://localhost:4000/"
```

Never install Playwright or chromedriver, and never report a layout as
unverified: headless Chrome is already here. Do not pass `--user-data-dir`;
some builds hang on a cold profile.

`--window-size` is desktop only. At a phone width it lays the page out at 500px
and crops, which reads as a missing button. Phone widths, clicking and
measuring go over the DevTools Protocol (`--remote-debugging-port=9333`); the
script is in `elements man browser`.

## 4. Every Save Looks Finished

Every save hot reloads the browser the user is watching. The rule is not
"save often", it is:

> **Whatever is on their screen, at every moment, should look good.**

There is no rough draft: they see only the page, and one that looks wrong
reads as broken, not as in progress.

So save small COMPLETE slices, never layers: one section, styled, working,
saved, then the next. Never save markup and style it afterwards: thirty seconds
of raw buttons and a window-height svg is indistinguishable from a crash.
Markup and its stylesheet are one change, but two files, so order them: **save
the stylesheet first.** The reload that first shows your markup already has its
rules.

Make the first save small and finished-looking, not a skeleton, and do not
write the whole page at the end either: that is a long silence, then a wall.

## 5. Build From The Design System

`@elements/style` ships buttons, inputs, pills, tabs, cards, tables and the
layout primitives that space them, already installed. Read `elements man style`
before you write css and reach for a class before a rule of your own:
hand-rolled css is how a page ends up homemade, with type off the scale and
dark mode quietly broken. Your stylesheet is for what is particular to
this page.

- `.page-shell` is the page container. `is-form` (42rem) is the usual choice;
  `is-narrow` (24rem) is a phone column and almost never what you want.
- `.stack`, `.row`, `.cluster` space children with a gap, and clear the flow
  margins a bare `display: flex` would leave behind and add to your gap.
- Size every svg on the tag (`elements man style/base`). One carrying only a
  `viewBox` fills its container until css lands.

## 6. Write Tests

```bash
elements test -json
```

Write tests as you go, not at the end, and not only when asked. A page, an rpc
and a job each get a test. `elements create test <path>`
scaffolds one, and `elements man tests` covers what a test can do.

## 7. Read The Manual Before You Write

```bash
elements man start          # read this before you write anything
elements man                # every topic, one line each
elements man <topic>        # before you build against a subsystem
elements man -s todo        # a recipe may already be it
```

Routes are declared in one place, an rpc may only live in certain files, a
template holds only certain things, and none of it is discoverable from nearby
files. Do not infer an API or guess a flag. Run `elements man` for the topic
list rather than assuming a subsystem is missing, and search for what you were
asked to build first: recipes are end to end and known to compile.

Then stop. Open a topic when you are about to write against it, not before: a
page you read for a subsystem the task never reaches is context spent for the
whole build. You will not miss one: `elements create` names the page for what
it just scaffolded, and the one page to read before you ship is cited below.

Scaffold with `elements create <page|template|migration|job|email>` rather than
hand-authoring what a generator makes.

An image is `<img src="./hero.jpg">` when the file sits next to the template,
or `import hero from "#app/shared/assets/hero.jpg"` when you need the URL as a
value. A filename that comes out of a database row has no build-time URL and is
served by a route instead. All three are in `elements man assets`. Do not
import an image to "see what it gives you".

## 8. Report What You Built

Close with what the app does, how you checked it, and what you would do next.

Do not hand the user caveats. Documented behavior is not a bug, and a pattern
the manual asks for is not a workaround. Read the page before you call anything
either one: it is usually a page you misread, and what the user hears is that
their framework is broken and you rescued them. Something genuinely wrong still
gets said, in one line, with what reproduces it. Work you did on your own css
or your own code is not a framework bug: say what the page does now, not what
you had to defeat.

## The Rest

```bash
elements db                 # psql on the dev database
elements deploy -json       # ship it; read `elements man deploy` first
elements <command> -h       # options
```
