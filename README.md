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
- **Global fuzzy search** across every field including notes and interactions.
- **Contact detail** — profile, interaction timeline, background (school,
  connection type, who introduced you), one-click *Log interaction*, coffee-chat
  prep brief, compose-from-template.
- **Quick-capture form** — name is the only required field; paste-from-LinkedIn
  auto-fill; duplicate detection warns on matching name + company.
- **Recruiting pipeline** — Kanban board (Researching → Applied → Interviewing →
  Offer → Closed) linking opportunities to the contacts who can help.
- **Outreach templates** — reusable messages with `{{firstName}}` /
  `{{company}}` mail-merge, composed straight to email.
- **Tags** — create, rename, color-code, delete (auto-detaches from contacts).
- **Import / export** — full JSON backup + restore (merge or replace), CSV export.
- **Keyboard** — `⌘/Ctrl-K` command palette, `N` for a new contact.
- Dark mode (follows system by default), responsive down to mobile, empty states,
  loading skeletons, and toast confirmations throughout.

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
