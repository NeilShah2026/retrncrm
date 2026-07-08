-- Retrn — initial schema. Run this once in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run), or via the Supabase
-- CLI (`supabase db push`) if you have it set up.
--
-- Every table is scoped to auth.uid() via Row Level Security, so one user
-- can never read or write another user's rows — enforced in Postgres itself,
-- not just in application code.

-- ---------------------------------------------------------------------------
-- Shared: auto-maintain updated_at on row update
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  first_name text not null,
  last_name text not null default '',
  photo text,

  company text,
  job_title text,
  industry text,

  linkedin_url text,
  email text,
  phone text,
  twitter text,
  other_links jsonb not null default '[]'::jsonb,

  connection_type text,
  school text,
  grad_year text,
  major text,
  source text,
  introduced_by_id uuid,
  talking_points text,

  how_we_met text,
  where_we_met text,
  date_met date,

  tag_ids uuid[] not null default '{}',
  relationship_strength smallint not null default 3,

  last_contact_date date,
  contact_frequency_goal text not null default 'none',

  notes text,
  interactions jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_user_id_idx on public.contacts (user_id);

alter table public.contacts enable row level security;

create policy "select own contacts" on public.contacts
  for select using (auth.uid() = user_id);
create policy "insert own contacts" on public.contacts
  for insert with check (auth.uid() = user_id);
create policy "update own contacts" on public.contacts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own contacts" on public.contacts
  for delete using (auth.uid() = user_id);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'slate',
  created_at timestamptz not null default now()
);

create index tags_user_id_idx on public.tags (user_id);

alter table public.tags enable row level security;

create policy "select own tags" on public.tags
  for select using (auth.uid() = user_id);
create policy "insert own tags" on public.tags
  for insert with check (auth.uid() = user_id);
create policy "update own tags" on public.tags
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own tags" on public.tags
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  company text not null,
  role text not null,
  type text not null default 'internship',
  stage text not null default 'researching',
  outcome text,
  location text,
  link text,
  deadline date,
  applied_date date,
  notes text,
  contact_ids uuid[] not null default '{}',
  "order" integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_user_id_idx on public.opportunities (user_id);

alter table public.opportunities enable row level security;

create policy "select own opportunities" on public.opportunities
  for select using (auth.uid() = user_id);
create policy "insert own opportunities" on public.opportunities
  for insert with check (auth.uid() = user_id);
create policy "update own opportunities" on public.opportunities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own opportunities" on public.opportunities
  for delete using (auth.uid() = user_id);

create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- templates
-- ---------------------------------------------------------------------------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  category text not null default 'other',
  subject text,
  body text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index templates_user_id_idx on public.templates (user_id);

alter table public.templates enable row level security;

create policy "select own templates" on public.templates
  for select using (auth.uid() = user_id);
create policy "insert own templates" on public.templates
  for insert with check (auth.uid() = user_id);
create policy "update own templates" on public.templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own templates" on public.templates
  for delete using (auth.uid() = user_id);

create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime: let the client subscribe to live changes on these tables
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.tags;
alter publication supabase_realtime add table public.opportunities;
alter publication supabase_realtime add table public.templates;
