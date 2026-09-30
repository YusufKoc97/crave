-- 018 — daily check-ins ("craving-free day" self-report).
--
-- One row per (user, addiction, day) the user claimed as clean. The
-- primary key IS the idempotency guarantee: a second claim for the same
-- day cannot insert, so it cannot pay twice. Points are recorded on the
-- row so a claim is auditable after the fact.
--
-- Writes happen ONLY in the `daily-checkin` Edge Function (service
-- role), which validates the day, the eligibility and the daily cap.
-- The app may read its own rows (to know what it already claimed) and
-- nothing else — same lockdown pattern as 009 / 017.

begin;

create table if not exists public.daily_checkins (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  addiction_id text        not null,
  day          date        not null,
  points       integer     not null check (points >= 0),
  created_at   timestamptz not null default now(),
  primary key (user_id, addiction_id, day)
);

alter table public.daily_checkins enable row level security;

drop policy if exists daily_checkins_owner_read on public.daily_checkins;
create policy daily_checkins_owner_read on public.daily_checkins
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.daily_checkins from public, anon, authenticated;
grant select on public.daily_checkins to authenticated;
grant all on public.daily_checkins to service_role;

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
  ) then
    raise exception 'daily_checkins: client roles hold write grants';
  end if;
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'daily_checkins'
      and grantee = 'anon'
  ) then
    raise exception 'daily_checkins: anon holds grants';
  end if;
  raise notice 'daily_checkins verified';
end $$;

commit;
