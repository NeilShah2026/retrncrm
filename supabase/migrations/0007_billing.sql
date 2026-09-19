-- ---------------------------------------------------------------------------
-- Billing: web subscriptions (Stripe) and the free plan's contact limit.
--
-- Run in the Supabase Dashboard → SQL Editor, after 0001–0006.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- subscriptions
--
-- One row per account that has ever started a Stripe checkout. Written only
-- by the server (/api/billing and the Stripe webhook, with the service role
-- key); the browser can read its own row to show the plan, and nothing else.
-- An App Store subscription validated server-side should land here too
-- (provider = 'app_store') so the contact limit below honours it.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  -- 'student' | 'standard'
  plan text,
  -- 'monthly' | 'yearly'
  period text,
  -- Stripe's own status: active, trialing, past_due, canceled, incomplete…
  status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- When the first-six-months discount stops applying, while it does.
  discount_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "select own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

alter publication supabase_realtime add table public.subscriptions;

-- ---------------------------------------------------------------------------
-- Who has paid access. The same rules as src/hooks/useEntitlement.ts:
-- a live subscription, or the Babson offer (a verified school email, or an
-- account that signs in with a confirmed @babson.edu address).
-- ---------------------------------------------------------------------------
create or replace function public.has_paid_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    exists (
      select 1 from public.subscriptions s
      where s.user_id = uid
        -- past_due keeps access while Stripe retries the card.
        and s.status in ('active', 'trialing', 'past_due')
    )
    or exists (
      select 1 from auth.users u
      where u.id = uid
        and (
          coalesce(u.raw_app_meta_data ->> 'babson_verified', 'false') = 'true'
          or (
            u.email_confirmed_at is not null
            and (lower(u.email) like '%@babson.edu' or lower(u.email) like '%.babson.edu')
          )
        )
    );
$$;

-- Not callable from the browser: it would say whether *any* account pays.
revoke execute on function public.has_paid_access(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The free plan holds 30 contacts. Enforced here, not only in the app, so
-- every way in (the app, the Chrome extension, an import) is held to it.
-- Keep the number equal to FREE_CONTACT_LIMIT in src/lib/billing/plans.ts.
--
-- Accounts already over the limit keep everything they have; they just can't
-- add more until they upgrade.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_free_contact_limit()
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
  perform pg_advisory_xact_lock(hashtext('retrn-contacts:' || new.user_id::text));

  if (select count(*) from public.contacts where user_id = new.user_id) >= 30 then
    raise exception 'FREE_CONTACT_LIMIT'
      using errcode = 'P0001',
            hint = 'The free plan holds 30 contacts. Upgrade for unlimited.';
  end if;

  return new;
end;
$$;

create trigger contacts_free_limit
  before insert on public.contacts
  for each row execute function public.enforce_free_contact_limit();
