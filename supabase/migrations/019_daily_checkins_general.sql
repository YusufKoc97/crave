-- 019 — the daily check-in is one GENERAL bonus per day, not per addiction.
--
-- 018 keyed claims by (user, addiction, day). But "yesterday was
-- craving-free" is a statement about the person, not about one habit,
-- so the claim is now one row per (user, day) and its points go to the
-- user's TOTAL only. They are not credited to any single addiction, so
-- per-addiction rank ladders are untouched.
--
-- daily_checkins held nothing but QA rows when this ran (the feature was
-- hours old and unshipped), so it is dropped and recreated rather than
-- migrated. user_total_score becomes  Σ addiction scores + Σ bonuses;
-- the column names/types are unchanged, so callers keep working.

begin;

drop table if exists public.daily_checkins;

create table public.daily_checkins (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  day        date        not null,
  points     integer     not null check (points >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.daily_checkins enable row level security;

create policy daily_checkins_owner_read on public.daily_checkins
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.daily_checkins from public, anon, authenticated;
grant select on public.daily_checkins to authenticated;
grant all on public.daily_checkins to service_role;

-- Same view, one more source. security_invoker stays on, so RLS on both
-- tables still scopes every caller to their own rows.
create or replace view public.user_total_score as
  select user_id, coalesce(sum(pts), 0)::integer as total_score
  from (
    select user_id, score::bigint as pts from public.user_addiction_scores
    union all
    select user_id, points::bigint as pts from public.daily_checkins
  ) s
  group by user_id;

alter view public.user_total_score set (security_invoker = true);
revoke all on public.user_total_score from anon;

do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'daily_checkins'
      and c.relrowsecurity
  ) then
    raise exception 'daily_checkins: RLS not enabled';
  end if;
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'daily_checkins'
      and grantee in ('anon', 'authenticated')
      and privilege_type <> 'SELECT'
  ) or exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'daily_checkins'
      and grantee = 'anon'
  ) then
    raise exception 'daily_checkins: client roles hold extra grants';
  end if;
  if exists (
    select 1 from pg_class
    where oid = 'public.user_total_score'::regclass
      and coalesce(array_to_string(reloptions, ','), '')
          not like '%security_invoker=true%'
  ) then
    raise exception 'user_total_score lost security_invoker';
  end if;
  if exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'user_total_score'
      and grantee = 'anon'
  ) then
    raise exception 'anon can read user_total_score';
  end if;
  raise notice 'daily_checkins (general) verified';
end $$;

commit;
