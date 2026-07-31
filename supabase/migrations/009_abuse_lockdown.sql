-- 009_abuse_lockdown.sql
--
-- Closes the abuse surface found by the 2026-07-31 rate-limit/anti-spam
-- audit. Everything here is server-side and therefore unbypassable by a
-- modified client — which is the point: every control that existed
-- before this migration lived in client code or in a console.warn().
--
-- Applied to production 2026-07-31. All target tables had 0 rows at the
-- time, so the CHECK validations were instant.
--
-- Ordered so that nothing depends on a later step. Idempotent — safe to
-- re-run.

begin;

------------------------------------------------------------
-- 1. user_total_score was readable by ANY caller, signed in
--    or not.
--
--    003_backend_scoring.sql:101 claims "Views inherit RLS from base
--    tables." That is false for a view owned by `postgres`, which has
--    rolbypassrls = true: the view runs as its definer, so the
--    owner_read policy on user_addiction_scores is never applied.
--    EXPLAIN under `SET LOCAL ROLE anon` confirmed a bare Seq Scan
--    with no RLS filter — i.e. the anon key (which ships in the app
--    bundle by design) could dump every user's id and total score.
--
--    security_invoker makes the view run as the CALLER, so the
--    existing owner_read policy finally applies. service_role still
--    bypasses RLS, so resolve-craving keeps working.
------------------------------------------------------------

alter view public.user_total_score set (security_invoker = true);
revoke all on public.user_total_score from anon;
alter table public.user_addiction_scores force row level security;

------------------------------------------------------------
-- 2. anon had INSERT/UPDATE/DELETE/TRUNCATE on every table.
--
--    Only RLS quals evaluating auth.uid() to NULL were stopping it.
--    The app has no legitimate anon write path anywhere, so remove
--    the grant itself rather than relying on a policy to hold.
------------------------------------------------------------

revoke insert, update, delete, truncate on all tables in schema public
  from anon;

------------------------------------------------------------
-- 3. craving_sessions was FOR ALL to the client.
--
--    Worst consequence was not forged rows but DELETE-then-replay:
--    resolve-craving's idempotency check (index.ts:195) keys on the
--    existing row, so deleting it let the same session_id be awarded
--    points again, without limit. The Edge Function cannot defend
--    against this on its own — only the DB can.
--
--    Verified safe: the client's ONLY access is a SELECT at
--    context/SessionsContext.tsx:143. Every write goes through an
--    Edge Function using the service role.
------------------------------------------------------------

drop policy if exists craving_sessions_owner_all on public.craving_sessions;

create policy craving_sessions_owner_read on public.craving_sessions
  for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.craving_sessions from authenticated;

do $$
begin
  alter table public.craving_sessions
    add constraint craving_sessions_addiction_id_check
    check (addiction_id in ('nicotine','alcohol','caffeine','vape','gambling',
                            'junk_food','shopping','pmo','doomscroll','gaming'));
exception when duplicate_object then null;
end $$;

------------------------------------------------------------
-- 4. profiles UPDATE had no column scope.
--
--    own_profile_update lets the client write ANY column, including
--    momentum and streak — the two values resolve-craving's header
--    (index.ts:14-16) promises "a jailbroken client can't inflate".
--    It could. Narrow the grant to the one column the app actually
--    writes (lib/profile.ts:32).
--
--    The format CHECK mirrors the picker exactly
--    (app/setup-username.tsx:26-27 MIN_LEN/MAX_LEN and :83's
--    character filter), so no honest client can trip it. lib/profile.ts
--    trims before writing, which is the one case the picker allows
--    through.
--
--    The case-insensitive unique index closes handle-squatting via
--    case variants (Alice vs alice).
------------------------------------------------------------

revoke update on public.profiles from authenticated, anon;
grant update (username) on public.profiles to authenticated;

do $$
begin
  alter table public.profiles
    add constraint profiles_username_format
    check (username is null
           or (char_length(username) between 3 and 24
               and username ~ '^[a-zA-Z0-9_-]+$'));
exception when duplicate_object then null;
end $$;

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

------------------------------------------------------------
-- 5. Bound the free-form text columns.
--
--    trigger_id and technique_id were unbounded text with no
--    whitelist: a scripted client could store 1GB per value, or
--    invent ids that corrupt every aggregate the Info tab computes.
--
--    technique_id's four values are the complete set from
--    constants/toolkitCatalog.ts:36-60. trigger_id gets a shape check
--    rather than a 87-value whitelist so the catalog can grow without
--    a migration.
------------------------------------------------------------

do $$
begin
  alter table public.craving_session_triggers
    add constraint craving_session_triggers_trigger_id_shape
    check (char_length(trigger_id) between 1 and 40
           and trigger_id ~ '^[a-z0-9_]+$');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.technique_uses
    add constraint technique_uses_technique_id_check
    check (technique_id in ('breathing_478','urge_surfing',
                            'grounding_54321','body_scan'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.technique_uses
    add constraint technique_uses_addiction_id_check
    check (addiction_id is null
           or addiction_id in ('nicotine','alcohol','caffeine','vape','gambling',
                               'junk_food','shopping','pmo','doomscroll','gaming'));
exception when duplicate_object then null;
end $$;

-- Dropping used_at from the INSERT grant forces DEFAULT now(), so the
-- client can no longer forge when a technique was used (which would
-- falsify the heatmap and every "this week" statistic).
revoke insert on public.technique_uses from authenticated;
grant insert (id, user_id, technique_id, context, addiction_id, session_id)
  on public.technique_uses to authenticated;

------------------------------------------------------------
-- 6. Atomic rate-limit primitive.
--
--    resolve-craving's limiter did SELECT count -> compute -> UPSERT
--    an ABSOLUTE value. That is last-write-wins: N concurrent calls
--    all read k and all write k+1, so the counter undercounts exactly
--    when it matters. Enforcing a 429 on top of that would have been
--    bypassable by simply issuing requests in parallel.
--
--    This does the increment inside one statement and returns the new
--    value. SECURITY DEFINER + service_role-only EXECUTE, so a client
--    can neither call it nor reset its own bucket (rate_limits has RLS
--    on and zero policies, which is already correct).
------------------------------------------------------------

create or replace function public.bump_rate_limit(
  p_user uuid,
  p_endpoint text,
  p_bucket text,
  p_amount int default 1
) returns int
language sql
security definer
set search_path = public
as $$
  insert into rate_limits (user_id, endpoint, hour_bucket, count)
  values (p_user, p_endpoint, p_bucket, p_amount)
  on conflict (user_id, endpoint, hour_bucket)
  do update set count = rate_limits.count + p_amount
  returning count;
$$;

revoke all on function public.bump_rate_limit(uuid, text, text, int)
  from public, anon, authenticated;
grant execute on function public.bump_rate_limit(uuid, text, text, int)
  to service_role;

------------------------------------------------------------
-- 7. Verifier — fail loudly rather than silently half-applying.
------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'user_total_score'
      and coalesce(array_to_string(c.reloptions, ','), '')
          not like '%security_invoker=true%'
  ) then
    raise exception 'user_total_score is still SECURITY DEFINER';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  ) then
    raise exception 'anon still holds write grants in public';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'craving_sessions'
      and cmd = 'ALL'
  ) then
    raise exception 'craving_sessions still has a FOR ALL policy';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'bump_rate_limit'
  ) then
    raise exception 'bump_rate_limit was not created';
  end if;

  raise notice 'lockdown verified';
end $$;

commit;
