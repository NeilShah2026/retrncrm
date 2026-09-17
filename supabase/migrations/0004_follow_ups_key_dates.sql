-- ---------------------------------------------------------------------------
-- Follow-ups and key dates.
--
-- A follow-up is a one-off promise with a date on it ("email her back in
-- December"), as opposed to contacts.contact_frequency_goal, which is a
-- standing cadence. A key date is something that comes round every year —
-- a birthday, a work anniversary.
--
-- Run this in the Supabase Dashboard → SQL Editor (same as 0001_init.sql).
-- Until it has run, the app keeps working; these two features just stay empty.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- follow_ups
-- ---------------------------------------------------------------------------
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- A real foreign key (unlike events.contact_ids): a follow-up is about one
  -- person and means nothing once they are deleted.
  contact_id uuid not null references public.contacts(id) on delete cascade,

  due_date date not null,
  note text,
  -- Null while open. Kept rather than deleting the row, so a finished
  -- follow-up can be undone.
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index follow_ups_user_id_idx on public.follow_ups (user_id);
create index follow_ups_open_idx on public.follow_ups (user_id, due_date)
  where completed_at is null;
create index follow_ups_contact_id_idx on public.follow_ups (contact_id);

alter table public.follow_ups enable row level security;

create policy "select own follow_ups" on public.follow_ups
  for select using (auth.uid() = user_id);
create policy "insert own follow_ups" on public.follow_ups
  for insert with check (auth.uid() = user_id);
create policy "update own follow_ups" on public.follow_ups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own follow_ups" on public.follow_ups
  for delete using (auth.uid() = user_id);

create trigger follow_ups_set_updated_at
  before update on public.follow_ups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- key_dates
-- ---------------------------------------------------------------------------
create table public.key_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  -- "Birthday", "Work anniversary", or anything the user types.
  label text not null default 'Birthday',
  -- Month and day recur; the year is optional because a birthday is usually
  -- known without one.
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  year smallint check (year between 1900 and 2200),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index key_dates_user_id_idx on public.key_dates (user_id);
create index key_dates_contact_id_idx on public.key_dates (contact_id);

alter table public.key_dates enable row level security;

create policy "select own key_dates" on public.key_dates
  for select using (auth.uid() = user_id);
create policy "insert own key_dates" on public.key_dates
  for insert with check (auth.uid() = user_id);
create policy "update own key_dates" on public.key_dates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own key_dates" on public.key_dates
  for delete using (auth.uid() = user_id);

create trigger key_dates_set_updated_at
  before update on public.key_dates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.follow_ups;
alter publication supabase_realtime add table public.key_dates;
