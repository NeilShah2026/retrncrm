# Retrn — Personal CRM

A personal CRM for tracking the people you meet **beyond LinkedIn** — at
events, on a flight, on the bus, over coffee — so you can search and
reconnect with them months or years later. Built with students in mind:
campus event tagging, a recruiting pipeline board, warm-intro context, and
outreach templates sit alongside the core contact CRM.

Data lives in **Supabase** (Postgres + Auth), scoped to your account with
row-level security. Sign in with email + password or a magic link — see
*Auth* below.

## Stack

- **Vite + React + TypeScript** (strict mode)
- **Tailwind CSS + shadcn/ui** (Radix primitives) — Linear/Notion-style UI
- **Supabase** — Postgres, Auth (password + magic link), Realtime
- **Fuse.js** for fuzzy global search
- **react-router**, **sonner** (toasts), **cmdk** (command palette)

## Getting started

1. Create a project at [supabase.com](https://supabase.com) (or use an
   existing one).
2. In the Supabase Dashboard, open **SQL Editor** and run the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates the `contacts`, `tags`, `opportunities`, and `templates`
   tables, enables row-level security, and turns on Realtime for all four.
3. Copy `.env.example` to `.env.local` and fill in your project's URL and
   anon/public key (Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

   `.env.example` also lists the **server-only** variables the functions in
   `api/` read: `SUPABASE_SERVICE_ROLE_KEY` for the iCal feed, and
   `AI_GATEWAY_URL` / `AI_GATEWAY_KEY` / `AI_MODEL` for the AI features. None
   of them take a `VITE_` prefix, and none are required to run the app.

4. Install and run:

   ```bash
   npm install
   npm run dev      # http://localhost:5173
   npm run build    # type-check + production build
   ```

- `/` — the public marketing page (no auth required, loads instantly).
- `/login` — sign in / sign up (password or magic link).
- `/app` — the product itself: dashboard, contacts, pipeline, templates,
  tags, settings. Gated by `RequireAuth`; signed-out visitors are redirected
  to `/login`.

The first time someone signs up, the app seeds **one clearly-labeled example
contact** plus a small starter library of outreach templates into their
account — no roster of fake people. Delete the example contact whenever you
like, or wipe everything from **Settings → Clear all data**. **Settings →
Restore starter content** brings the example contact and templates back.

## Features

- **Marketing site** (`/`) — dark hero, real in-app screenshots, feature
  walkthrough, pricing, all in one page.
- **Dashboard** — answers "what should I do now?" before it shows anything
  else: an AI **briefing** of the few things worth doing today, the next
  **upcoming meetings** with the people in them, a **needs-a-nudge** list of
  whoever has waited longest (with one-tap *Caught up* and prep), totals,
  recently added, and the recruiting-pipeline snapshot. There is no
  "recent activity" feed — a log of what already happened is pleasant to
  scroll and useless to act on.
- **Contacts** — sortable table ↔ card grid toggle; filter by tag, company,
  industry, where-met, connection type, date-met range, relationship strength,
  and "overdue". The page header and toolbar are pinned — only the contact
  list scrolls, with its own sticky table header.
- **Say who you met** — the primary way to add someone: tap the mic, speak one
  sentence ("met Sarah Chen at the career fair, she's a PM at Fidelity, Babson
  alum class of 2022, follow up in a month"), and it becomes a contact. Speech
  recognition is the browser's own Web Speech API — free, no key, no audio
  leaving the browser session — and `src/lib/voiceParse.ts` turns the sentence
  into fields locally. Browsers without it (Firefox) fall back to typing, where
  a phone keyboard's dictation works just as well. `V` opens it.
- **Global fuzzy search** across every field including notes and activity.
- **Contact detail** — profile, activity timeline, background (school,
  connection type, who introduced you), one-tap *Caught up*, coffee-chat prep
  brief, compose-from-template.
- **Quick-capture form** — name is the only required field; paste-from-LinkedIn
  auto-fill; duplicate detection warns on matching name + company.
- **Recruiting pipeline** — Kanban board (Researching → Applied → Interviewing →
  Offer → Closed) linking opportunities to the contacts who can help.
- **Calendar** — month grid and agenda of meetings with the people in your
  network, with application deadlines overlaid. A past meeting logs itself to
  the linked contacts' timelines, and the whole thing publishes as an iCal
  feed you can subscribe to (**Subscribe**).
- **Outreach templates** — reusable messages with `{{firstName}}` /
  `{{company}}` mail-merge, composed straight to email.
- **Tags** — create, rename, color-code, delete (auto-detaches from contacts),
  and **auto-tag**: read the whole network at once and approve the tags it
  proposes, rather than tagging people one at a time forever (see *AI tagging*).
- **Import / export** — full JSON backup + restore (merge or replace), CSV export.
- **Keyboard** — `⌘/Ctrl-K` command palette, `V` to say who you met, `N` for
  the new-contact form.
- **On a phone** — the app is built for the thumb, not scaled down from the
  desktop. The assistant sits in the middle of the bottom bar (Home ·
  Contacts · **Assistant** · Calendar · More) and again at the top of the home
  screen as a full-width composer with rotating examples, because typing a
  sentence beats navigating to a form when you're standing up. Dialogs are
  bottom sheets, the calendar opens on the agenda rather than a seven-column
  grid, contacts render as cards, every field is 16px so iOS never zooms the
  page on focus, and the layout respects the notch and the on-screen keyboard.
- Dark mode (follows system by default), empty states, loading skeletons, and
  toast confirmations throughout.

### Activity, not a logbook

There is no "log an interaction" form, on purpose. Asking someone to type up
every conversation is more friction than the record is worth, and the reconnect
engine only ever reads one field — `lastContactDate` (see
`src/lib/reconnect.ts`). So a contact's **Activity** feed fills itself in from
scheduled meetings (`src/hooks/useAutoLogMeetings.ts`) and emails caught by the
browser extension, and resetting the nudge is a single **Caught up** tap
(`src/lib/caughtUp.ts`) available on the contact header, the prep dialog, and
the row menus in both contact views. Anything worth remembering goes in notes.

## AI features

AI is an accelerator on top of features that already work without it — every
one of them falls back to its non-AI path if the model is unreachable or
unconfigured, and **no AI call ever gates a save**.

- **Smart capture** — a second read of a dictated sentence, filling what the
  local parser missed, correcting what it got wrong, and tidying the sentence
  into a readable note. It runs once on its own, ~1.2s after the sentence stops
  changing, so typing and phone-keyboard dictation get the same pass as the
  in-browser mic. Every change is listed before you save.
- **Daily briefing** — the dashboard's first card. The overdue list, the next
  two weeks of meetings, and the applications in flight go up as one compact
  snapshot; an ordered handful of specific actions comes back, each one citing
  the fact that made it urgent and each pointing at a real record (the model
  answers with references into the snapshot, never a name it typed). Acting on
  it prunes the list rather than buying a new one, and the answer is cached
  against a fingerprint of the facts behind it, so a day of tapping *Caught up*
  costs about one request. With AI off the same list is written by plain rules.
- **The assistant** — one box that both answers questions about your network
  and records what you tell it, reached from `⌘K`, the sidebar, the dashboard,
  or the phone's bottom bar.
  - *Ask* — natural-language questions over your own contacts ("who do I know
    in fintech in Boston?", "how many people do I know at Fidelity?"). It holds
    a thread — the roster is sent once and follow-ups ride on it, so "which of
    them have I not spoken to since spring?" costs a sentence — and offers the
    next questions worth asking. Falls back to the existing Fuse.js search.
  - *Tell* — "met Priya at the AI meetup, she's a PM at Klaviyo, coffee next
    Tuesday at 3" comes back as a **plan**: add this contact, schedule that
    meeting. Seven kinds of action are possible — add a contact, schedule a
    meeting, mark someone caught up, add a note, tag someone, set a follow-up
    cadence, add a pipeline opportunity — and the plan is itemised on screen
    with each line switchable off. Nothing is written until you tap *Do it*.
    Relative times ("next Tuesday at 3") are resolved to real timestamps by the
    model, which is told today's date; names are resolved to contacts by
    `lib/ai/actions.ts`, which refuses anything ambiguous rather than writing
    to the wrong Sarah. There is no delete action, by design: the worst a wrong
    plan can do is leave something to tidy up.
- **Draft outreach** — a first-person draft in the compose dialog, using the
  contact's context and the template's tone. Never sends anything itself.
- **Coffee-chat prep** — generated talking points you can save to the contact.
- **AI tagging** — tags read off the record instead of typed. Tagging is the
  chore of a personal CRM: the payoff arrives months later ("who do I know in
  fintech?") and the cost lands the moment you meet someone, so it never gets
  done. Three places it now happens for you, all of them proposals you approve:
  the contact form suggests tags on its own once the fields settle; a dictated
  sentence gets tagged in the same pass that fills the rest of the form; and
  **Auto-tag** (Contacts and Tags headers) reads everyone with no tags in one
  batched run and lays the result out as a checklist. Your existing tags are
  the vocabulary — a new tag is a last resort, because a network sliced forty
  ways is a network with no tags at all — and a run can only ever *add* tags.
  With AI off, the same affordances fall back to `src/lib/tagging.ts`, which
  matches your existing tags against what's written on the record.

The model is reached only through `api/ai.ts` (a Vercel edge function wrapping
`api/_lib/ai.ts`). The gateway key is a **server-only** env var and must never
get a `VITE_` prefix — that prefix is exactly what puts a value in the browser
bundle. The endpoint verifies the caller's Supabase access token before
spending anything, so it can't be used as an open relay, and it caps both
`max_tokens` and body size. Leave `AI_GATEWAY_URL`/`AI_GATEWAY_KEY` blank and
the app simply runs without AI.

`vite dev` doesn't serve `/api` — that's Vercel's job in production — so
`vite.config.ts` mounts a dev-only middleware that calls the *same* handler,
which is why the handler reads its env per request rather than at import time.

## Auth

`src/auth/AuthProvider.tsx` wraps the app in a Supabase Auth session:
email + password sign-up/sign-in, and passwordless magic-link sign-in. The
`/app/*` route tree is gated by `src/auth/RequireAuth.tsx`, which redirects
signed-out visitors to `/login`. New accounts are seeded once via
`src/lib/seedNewUser.ts`, which flags itself done in the user's
`user_metadata` so it never reseeds.

## Architecture

The data layer sits behind a repository interface, so the storage engine
could be swapped again without touching UI code:

```
src/
  types/                 Domain models (Contact, Tag, Interaction, Opportunity, …)
  services/
    types.ts             Repository interfaces  ← the contract
    supabase*.ts         Supabase implementations
    supabaseMappers.ts   Row <-> domain-model mapping
    index.ts             Exports the singleton repos  ← the single swap point
  hooks/useData.ts       Reactive reads, backed by Supabase Realtime
  auth/                  AuthProvider, RequireAuth
  lib/
    supabase.ts          Supabase client singleton
    database.types.ts    Generated-style Postgres schema types
    seedNewUser.ts        One-time starter content for new accounts
    routes.ts             Centralized route paths (the app lives under /app)
  lib/
    voiceParse.ts         Spoken sentence -> contact fields (local, no API)
    tagging.ts            Tag matching/creation + the rules-based suggester
    caughtUp.ts           One-tap last-contact reset
    ai/                   Client + per-feature prompts, all via /api/ai
                          (briefing.ts also ships the rules-based fallback)
      network.ts          The assistant: asks, and returns proposed actions
      actions.ts          Action schema, validation, preview text, executor
      tagging.ts          Single + bulk tag suggestion
  hooks/useSpeechRecognition.ts   Web Speech API wrapper
api/
  ai.ts                   Edge entry point for the model proxy
  _lib/ai.ts              The proxy itself (shared with the Vite dev server)
  calendar.ts             Public iCal feed
supabase/
  migrations/0001_init.sql  Schema + RLS policies, run manually in the
                             Supabase SQL Editor (no CLI/service-role wiring)
```

Components depend only on the hooks and the repo interfaces — never on
Supabase directly.

## Layout: scroll containment

Every app page follows the same shell (`src/components/layout/PageShell.tsx`):
a pinned header (title, description, actions, toolbar) that never scrolls, and
a single scrollable body beneath it. The sidebar and mobile chrome never scroll
either. Contacts and Pipeline go one step further — the header/toolbar is
pinned and *only* the table or board scrolls, with the table's column headers
sticky within that region.
