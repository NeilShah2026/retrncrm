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
- **Dashboard** — totals, recently added, reconnect suggestions (overdue by
  cadence goal or 6+ months), upcoming follow-ups, recruiting-pipeline snapshot.
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
- **Outreach templates** — reusable messages with `{{firstName}}` /
  `{{company}}` mail-merge, composed straight to email.
- **Tags** — create, rename, color-code, delete (auto-detaches from contacts).
- **Import / export** — full JSON backup + restore (merge or replace), CSV export.
- **Keyboard** — `⌘/Ctrl-K` command palette, `V` to say who you met, `N` for
  the new-contact form.
- Dark mode (follows system by default), responsive down to mobile, empty states,
  loading skeletons, and toast confirmations throughout.

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
  local parser missed and showing what it changed before you save.
- **Ask your network** — natural-language questions over your own contacts
  ("who do I know in fintech in Boston?"), from `⌘K` or the sidebar. Falls back
  to the existing Fuse.js search.
- **Draft outreach** — a first-person draft in the compose dialog, using the
  contact's context and the template's tone. Never sends anything itself.
- **Coffee-chat prep** — generated talking points you can save to the contact.

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
    caughtUp.ts           One-tap last-contact reset
    ai/                   Client + per-feature prompts, all via /api/ai
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
