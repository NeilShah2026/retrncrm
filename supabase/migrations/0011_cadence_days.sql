-- Reconnect cadence becomes a number of days ("45d") instead of a named
-- preset. The app already reads the old names (supabaseMappers →
-- normalizeFrequency), so this is a tidy-up, safe to run at any time.
--
-- Each preset keeps its own interval, so no one's schedule moves:
-- quarterly was 91 days and becomes the new 90-day preset.

update public.contacts
set contact_frequency_goal = case contact_frequency_goal
  when 'weekly' then '7d'
  when 'monthly' then '30d'
  when 'quarterly' then '90d'
  when 'biannually' then '182d'
  when 'annually' then '365d'
  else contact_frequency_goal
end
where contact_frequency_goal in ('weekly', 'monthly', 'quarterly', 'biannually', 'annually');

-- No check constraint: a tab still running the previous release would
-- write a name and fail. The app normalises whatever it reads.
