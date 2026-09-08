-- ---------------------------------------------------------------------------
-- Verified school email (the Babson free-access offer)
--
-- One row per account that has proven control of a school address. Written
-- only by /api/verify-edu with the service role key — never by the browser,
-- which is the whole point: the row (and the matching `babson_verified` flag
-- in auth app_metadata) is what unlocks paid features, so a user must not be
-- able to write it themselves.
--
-- `email` is unique so one school address can't unlock an unlimited number of
-- accounts; `user_id` is the primary key so an account holds at most one.
-- ---------------------------------------------------------------------------
create table public.edu_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  domain text not null,
  verified_at timestamptz not null default now()
);

create unique index edu_verifications_email_key
  on public.edu_verifications (lower(email));

alter table public.edu_verifications enable row level security;

-- Read-only to the owner: the badge in Settings shows which address was used.
-- There is deliberately no insert/update/delete policy — the endpoint bypasses
-- RLS with the service role key, and nothing else may write here.
create policy "select own edu verification" on public.edu_verifications
  for select using (auth.uid() = user_id);
