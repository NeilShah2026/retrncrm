-- ---------------------------------------------------------------------------
-- Cold emails.
--
-- A cold email target is someone you're writing to but haven't met: not a
-- contact yet, and deliberately kept apart from `contacts` so a list of forty
-- people you've emailed once doesn't swamp the network of people you know.
-- When one writes back, "Make a contact" copies them across and links the two
-- (contact_id), and the email history goes with them as interactions.
--
-- Each send — the first email and every follow-up — is one entry in `sends`,
-- the same shape as contacts.interactions. `next_follow_up` is when to nudge
-- them next; the app sets it from a fixed schedule each time a send is logged
-- (see src/lib/coldEmail.ts), and it can be changed or cleared by hand.
--
-- Run this in the Supabase Dashboard → SQL Editor (same as 0001_init.sql).
-- Until it has run, the app keeps working; the Cold email page just stays
-- empty.
-- ---------------------------------------------------------------------------

create table public.cold_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  first_name text not null default '',
  last_name text not null default '',
  email text,
  company text,
  role text,
  linkedin_url text,

  -- Why this person, in the sender's words — the thing a good cold email is
  -- built around, and what the AI draft is told to use.
  hook text,
  notes text,

  -- The email being worked on, kept so it survives a closed tab.
  draft_subject text,
  draft_body text,

  status text not null default 'drafting'
    check (status in ('drafting', 'sent', 'replied', 'converted', 'closed')),
  -- [{ id, date: 'yyyy-mm-dd', subject?, link?, createdAt }], oldest first.
  sends jsonb not null default '[]'::jsonb,
  next_follow_up date,
  replied_at timestamptz,
  -- Set by "Make a contact". The target stays, marked converted, so its
  -- history is still here; deleting the contact just unlinks it.
  contact_id uuid references public.contacts(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cold_targets_user_id_idx on public.cold_targets (user_id);
-- The extension looks targets up by address on every thread it opens.
create index cold_targets_email_idx on public.cold_targets (user_id, lower(email));
create index cold_targets_follow_up_idx on public.cold_targets (user_id, next_follow_up)
  where status = 'sent';

alter table public.cold_targets enable row level security;

create policy "select own cold_targets" on public.cold_targets
  for select using (auth.uid() = user_id);
create policy "insert own cold_targets" on public.cold_targets
  for insert with check (auth.uid() = user_id);
create policy "update own cold_targets" on public.cold_targets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own cold_targets" on public.cold_targets
  for delete using (auth.uid() = user_id);

create trigger cold_targets_set_updated_at
  before update on public.cold_targets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The free plan tracks 10 open targets at a time.
--
-- "Open" is anyone still in play: drafting, sent, or replied. Converting a
-- target to a contact or closing it frees the slot, so a free account can keep
-- working through a list — it just can't hold more than ten at once.
--
-- Keep the number equal to FREE_COLD_TARGET_LIMIT in src/lib/billing/plans.ts.
-- Like the contact limit, it's enforced here rather than in the app because
-- the Chrome extension writes to this table too.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_free_cold_target_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_paid_access(new.user_id) then
    return new;
  end if;

  -- Serialise this account's inserts so two at once can't both squeeze in.
  perform pg_advisory_xact_lock(hashtext('retrn-cold-targets:' || new.user_id::text));

  if (
    select count(*) from public.cold_targets
    where user_id = new.user_id
      and status in ('drafting', 'sent', 'replied')
  ) >= 10 then
    raise exception 'FREE_COLD_TARGET_LIMIT'
      using errcode = 'P0001',
            hint = 'The free plan tracks 10 cold email targets at a time. Upgrade for unlimited.';
  end if;

  return new;
end;
$$;

create trigger cold_targets_free_limit
  before insert on public.cold_targets
  for each row execute function public.enforce_free_cold_target_limit();

-- ---------------------------------------------------------------------------
-- Realtime, so a send logged from the extension shows up on an open page.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.cold_targets;
