-- ---------------------------------------------------------------------------
-- Shared cards — the QR code's short link, and what comes back through it.
--
-- A shareable profile has always travelled *inside* the link
-- (`/add#<token>`), which needs no server at all. That still works and is
-- still the fallback. A published card adds the things a self-contained link
-- can't do:
--
--   * a short, textable URL (`/c/neil-shah`) instead of a 300-character one,
--   * a count of how many people scanned it and how many saved the contact,
--   * a way for the person who scanned to send their own details *back*.
--
-- Run this in the Supabase Dashboard -> SQL Editor (same as 0001_init.sql).
-- Until it has run, the app keeps working: publishing fails softly and the
-- QR code falls back to the self-contained link.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- shared_cards
-- ---------------------------------------------------------------------------
create table public.shared_cards (
  -- The short link's path segment. Derived from the name, so it is the thing
  -- people read out loud; the primary key because that is how it is looked up.
  slug text primary key,
  -- One card per account: republishing updates this row rather than littering
  -- the table with dead links.
  user_id uuid not null unique references auth.users(id) on delete cascade,

  -- A snapshot of the ShareProfile at publish time, in the same shape the
  -- client uses. Deliberately a copy, not a view onto user_metadata: editing
  -- your profile should not silently rewrite a card someone already scanned
  -- until you republish.
  profile jsonb not null,

  -- How the card is doing. Counters rather than a row per scan: the interest
  -- is "did this work", and a log of who looked at whose card is not
  -- something this app should be keeping.
  scan_count integer not null default 0,
  save_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_cards enable row level security;

-- Owners may read their own card (the scan counts on the QR screen). Nobody
-- writes from the browser: publishing, and the public read that resolves a
-- scanned link, both go through the API with the service role, so a card can
-- never be published for an account that doesn't own it.
create policy "select own shared_card" on public.shared_cards
  for select using (auth.uid() = user_id);

create trigger shared_cards_set_updated_at
  before update on public.shared_cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- card_handoffs
--
-- A business card exchange goes both ways. When someone scans a card and
-- sends their own details back, they land here — not straight into the
-- owner's contacts. Anyone with the link can write one of these, so they wait
-- to be accepted on the QR screen rather than appearing unannounced in
-- someone's CRM.
-- ---------------------------------------------------------------------------
create table public.card_handoffs (
  id uuid primary key default gen_random_uuid(),
  card_slug text not null references public.shared_cards(slug) on delete cascade,
  -- The card's owner. Denormalised off shared_cards so the RLS policy below
  -- is a column comparison rather than a sub-query on every row read.
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  email text,
  phone text,
  company text,
  headline text,
  school text,
  -- What the sender chose to say about the meeting, and where/when it was.
  note text,
  where_we_met text,
  met_on date,

  -- Set once the owner has turned this into a contact. Kept rather than
  -- deleted so the same handoff can't be accepted twice.
  claimed_at timestamptz,

  created_at timestamptz not null default now()
);

create index card_handoffs_user_id_idx on public.card_handoffs (user_id);
create index card_handoffs_pending_idx on public.card_handoffs (user_id, created_at)
  where claimed_at is null;

alter table public.card_handoffs enable row level security;

-- The owner reads and resolves their own; the write comes from the API with
-- the service role, because the sender has no account.
create policy "select own card_handoffs" on public.card_handoffs
  for select using (auth.uid() = user_id);
create policy "update own card_handoffs" on public.card_handoffs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own card_handoffs" on public.card_handoffs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Counters
--
-- A scan is a public, unauthenticated event, so the increment is a function
-- the service role calls rather than an update the browser could aim at any
-- row. `which` is checked here so the API can't be tricked into writing an
-- arbitrary column name either.
-- ---------------------------------------------------------------------------
create or replace function public.bump_card_counter(card_slug text, which text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if which = 'scan' then
    update public.shared_cards set scan_count = scan_count + 1 where slug = card_slug;
  elsif which = 'save' then
    update public.shared_cards set save_count = save_count + 1 where slug = card_slug;
  end if;
end;
$$;

revoke execute on function public.bump_card_counter(text, text) from public, anon, authenticated;
grant execute on function public.bump_card_counter(text, text) to service_role;

comment on table public.shared_cards is
  'Published QR cards behind /c/<slug>. One per account; the profile is a snapshot taken at publish time.';
comment on table public.card_handoffs is
  'Details sent back by someone who scanned a card. Unclaimed until the owner accepts them on the QR screen.';
