-- ---------------------------------------------------------------------------
-- Calendar: scheduled meetings/events, plus a per-user token that powers the
-- read-only iCal subscribe feed.
--
-- Run this in the Supabase Dashboard → SQL Editor (same as 0001_init.sql).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  description text,
  location text,

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,

  -- Contacts this meeting is with. Loose references (same approach as
  -- contacts.tag_ids) so deleting a contact never breaks an event.
  contact_ids uuid[] not null default '{}',

  -- Set once the meeting has passed and been auto-logged to those contacts'
  -- interaction timelines, so it is only logged a single time.
  logged boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_user_id_idx on public.events (user_id);
create index events_starts_at_idx on public.events (user_id, starts_at);

alter table public.events enable row level security;

create policy "select own events" on public.events
  for select using (auth.uid() = user_id);
create policy "insert own events" on public.events
  for insert with check (auth.uid() = user_id);
create policy "update own events" on public.events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own events" on public.events
  for delete using (auth.uid() = user_id);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- calendar_tokens
--
-- One unguessable token per user. The public /api/calendar endpoint looks the
-- user up by this token (server-side, with the service role key) to serve
-- their .ics feed. Deleting the row instantly revokes any subscribed calendar.
-- ---------------------------------------------------------------------------
create table public.calendar_tokens (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.calendar_tokens enable row level security;

-- Users manage only their own token. The feed endpoint bypasses RLS by using
-- the service role key, so no public select policy is needed here.
create policy "select own calendar token" on public.calendar_tokens
  for select using (auth.uid() = user_id);
create policy "insert own calendar token" on public.calendar_tokens
  for insert with check (auth.uid() = user_id);
create policy "delete own calendar token" on public.calendar_tokens
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.events;
