-- ---------------------------------------------------------------------------
-- AI usage limits.
--
-- Every AI request costs real money and is made with our key, so each account
-- gets a daily allowance — a small one while they're on the free plan, a
-- larger one once they pay. Counted here rather than in the browser, because
-- the browser is the thing being limited.
--
-- Run in the Supabase Dashboard → SQL Editor, after 0007.
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  requests integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- Readable by its owner (so the app can show "12 of 25 today"); written only
-- by the function below, which runs as its owner.
create policy "select own ai usage" on public.ai_usage
  for select using (auth.uid() = user_id);

/**
 * Claim one request against today's allowance.
 *
 * Returns the new count, or -1 when the allowance is already used up. The
 * whole thing is one statement, so two requests at once can't both take the
 * last slot.
 */
create or replace function public.use_ai_quota(uid uuid, allowance integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  insert into public.ai_usage (user_id, day, requests)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update
    set requests = ai_usage.requests + 1
    where ai_usage.requests < allowance
  returning requests into used;

  -- No row came back: the ON CONFLICT update was filtered out, which only
  -- happens when they're at the cap.
  if used is null then
    return -1;
  end if;
  return used;
end;
$$;

-- Only the server may spend quota; the browser could otherwise grant itself
-- any allowance it liked. The API calls this with the service role key.
revoke execute on function public.use_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.use_ai_quota(uuid, integer) to service_role;

-- Yesterday's rows are only of interest for a day or two.
comment on table public.ai_usage is
  'Daily AI request counts per account. Safe to delete rows older than ~30 days.';
