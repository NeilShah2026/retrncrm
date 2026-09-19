-- ---------------------------------------------------------------------------
-- Pending school-email verifications.
--
-- Verifying a Babson address from Settings emails a magic link to it. That
-- link can be opened anywhere — the same laptop, or the phone the school inbox
-- lives on — so the page it lands on can't rely on the Retrn session being in
-- the same browser. Instead, "Send verification email" records which account
-- asked for which address here, and /api/verify-edu matches the proven
-- address back to that account when the link is opened.
--
-- Written only by /api/verify-edu with the service role key; no browser
-- policies at all. Run in the Supabase Dashboard → SQL Editor.
-- ---------------------------------------------------------------------------
create table public.edu_verification_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  requested_at timestamptz not null default now()
);

create index edu_verification_requests_email_idx
  on public.edu_verification_requests (lower(email));

alter table public.edu_verification_requests enable row level security;
