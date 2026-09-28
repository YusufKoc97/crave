-- 015_feedback.sql
--
-- In-app "Report a problem" channel. Signed-in users submit a short
-- free-text message (optionally tagged bug / idea / other); it lands
-- here as a row the maintainer triages from the Supabase dashboard,
-- NOT in an inbox. Keeps genuine bug reports out of the App Store /
-- Play Store reviews and gives us the context a star rating never
-- carries: who, which app version, which platform, when.
--
-- Security posture mirrors craving_sessions (migration 009): RLS ON
-- with ZERO client policies, so `authenticated` can neither read nor
-- write this table directly. Every insert goes through the
-- `submit-feedback` Edge Function under the service role, which is
-- also the only place the per-user rate limit (bump_rate_limit) can
-- be enforced unbypassably. A modified client cannot spam the table
-- or read anyone's reports.
--
-- Idempotent — safe to re-run. Wrapped in a transaction so a partial
-- apply cannot leave the table without its RLS lockdown.

begin;

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null default 'other'
              check (category in ('bug', 'idea', 'other')),
  -- Bounded on both ends: < 10 chars is almost always noise ("a",
  -- "test"), > 2000 is the paste-bomb spam vector. The client mirrors
  -- these limits so an honest user never trips the CHECK.
  message     text not null
              check (char_length(message) between 10 and 2000),
  -- Client-reported context. Nullable so a submit still succeeds if
  -- the app can't resolve them; validated to a small closed set so the
  -- column can't be used as free storage.
  app_version text
              check (app_version is null or char_length(app_version) <= 32),
  platform    text
              check (platform is null or platform in ('ios', 'android', 'web')),
  -- Triage state, driven from the dashboard.
  status      text not null default 'new'
              check (status in ('new', 'read', 'resolved')),
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- No policies granted to authenticated or anon on purpose: with RLS
-- enabled and no policy, every non-service-role access is denied. The
-- service role (Edge Function) bypasses RLS. Belt to that suspenders,
-- revoke the table-level write grants the way 009 does for the rest of
-- public, so the lockdown does not rely on RLS alone.
revoke insert, update, delete, truncate on public.feedback
  from anon, authenticated;

-- Dashboard triage reads newest-first; the user index supports the
-- CASCADE on account deletion and any per-user lookups.
create index if not exists feedback_created_idx
  on public.feedback (created_at desc);
create index if not exists feedback_user_idx
  on public.feedback (user_id);

------------------------------------------------------------
-- Verifier — fail loudly rather than silently half-applying.
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'feedback' and c.relrowsecurity
  ) then
    raise exception 'feedback table missing or RLS not enabled';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'feedback'
  ) then
    raise exception 'feedback has a client policy — it must have none';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'feedback'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) then
    raise exception 'feedback still holds client write grants';
  end if;

  raise notice 'feedback table verified';
end $$;

commit;
