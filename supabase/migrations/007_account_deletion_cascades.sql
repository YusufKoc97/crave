-- 007_account_deletion_cascades.sql
--
-- Guarantees that deleting an auth.users row erases everything the
-- user owns, so the delete-account Edge Function's final step
-- (auth.admin.deleteUser) cannot fail on a foreign-key violation.
--
-- WHY THIS EXISTS
-- Migrations 001 and 002 — the ones that created `profiles`,
-- `user_addictions`, `craving_sessions` and `momentum_log` — were
-- never committed. They were pasted into the SQL Editor by hand, and
-- there is no CLI, no schema dump and no CI, so the ON DELETE action
-- of those tables' foreign keys is unknowable from the repo. If even
-- one of them is the Postgres default (NO ACTION), deletion fails for
-- every user. This migration re-asserts the cascade explicitly and
-- then PROVES it with a verifier that raises loudly if anything is
-- still wrong — because a hand-run migration can silently not-run and
-- nobody would know.
--
-- HOW TO RUN
-- Paste into the Supabase SQL Editor and run once. It is idempotent —
-- safe to run again. Before running, you may want to inspect the
-- current state (this does not change anything):
--
--   SELECT conrelid::regclass AS child,
--          conname,
--          confrelid::regclass AS parent,
--          confdeltype   -- c=cascade, a=no action, r=restrict, n=set null
--   FROM   pg_constraint
--   WHERE  contype = 'f' AND connamespace = 'public'::regnamespace
--   ORDER  BY 1;
--
-- The four constraints already verified as cascading in tracked
-- migrations (user_addiction_scores, rate_limits, user_unlocked_ranks,
-- technique_uses → auth.users) are intentionally NOT touched here.

begin;

-- ─── 1. Drop legacy tables that may still be live ───────────────────
-- These were superseded during the Faz 1 cleanup and the DROP SQL was
-- only handed to the operator — there is no proof it ran. `addictions`
-- in particular references profiles(id) with an unrecorded ON DELETE
-- and is the most likely thing to block the profiles delete. Harmless
-- if already gone.
drop table if exists public.forum_reports cascade;
drop table if exists public.forum_likes cascade;
drop table if exists public.forum_posts cascade;
drop table if exists public.reflections cascade;
drop table if exists public.addictions cascade;

-- ─── 2. momentum_log: dead table, no readers ────────────────────────
-- Declared in lib/supabase.ts but never queried anywhere in the app.
-- An orphan table with an unknown FK is a silent deletion blocker, so
-- drop it. (If you would rather keep it, replace this line with the
-- same DROP CONSTRAINT / ADD CONSTRAINT ... ON DELETE CASCADE pattern
-- used in §3, pointed at auth.users(id).)
drop table if exists public.momentum_log cascade;

-- ─── 3. Re-assert the two unverifiable cascades ─────────────────────
-- Constraint names are resolved from pg_constraint rather than assumed
-- (do NOT hardcode `profiles_id_fkey` — the live name may differ).

-- profiles.id → auth.users(id) ON DELETE CASCADE
do $$
declare
  cname text;
begin
  if to_regclass('public.profiles') is null then
    raise notice 'profiles table absent — skipping';
  else
    for cname in
      select conname from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and contype = 'f'
        and confrelid = 'auth.users'::regclass
    loop
      execute format(
        'alter table public.profiles drop constraint %I', cname
      );
    end loop;
    execute
      'alter table public.profiles
         add constraint profiles_id_fkey
         foreign key (id) references auth.users(id) on delete cascade';
  end if;
end $$;

-- craving_sessions.user_id → auth.users(id) ON DELETE CASCADE
-- Repointed straight at auth.users (it historically referenced
-- profiles), collapsing the 3-hop chain to 2 and removing the ordering
-- dependency on the profiles delete entirely.
do $$
declare
  cname text;
begin
  if to_regclass('public.craving_sessions') is null then
    raise notice 'craving_sessions table absent — skipping';
  else
    for cname in
      select conname from pg_constraint
      where conrelid = 'public.craving_sessions'::regclass
        and contype = 'f'
        and conname ilike '%user_id%'
    loop
      execute format(
        'alter table public.craving_sessions drop constraint %I', cname
      );
    end loop;
    execute
      'alter table public.craving_sessions
         add constraint craving_sessions_user_id_fkey
         foreign key (user_id) references auth.users(id) on delete cascade';
  end if;
end $$;

-- user_addictions.user_id → auth.users(id) ON DELETE CASCADE
-- Documented as cascading (README code block) but never in a migration
-- file; re-assert idempotently so it is provable.
do $$
declare
  cname text;
begin
  if to_regclass('public.user_addictions') is null then
    raise notice 'user_addictions table absent — skipping';
  else
    for cname in
      select conname from pg_constraint
      where conrelid = 'public.user_addictions'::regclass
        and contype = 'f'
        and confrelid = 'auth.users'::regclass
    loop
      execute format(
        'alter table public.user_addictions drop constraint %I', cname
      );
    end loop;
    execute
      'alter table public.user_addictions
         add constraint user_addictions_user_id_fkey
         foreign key (user_id) references auth.users(id) on delete cascade';
  end if;
end $$;

-- ─── 4. Verifier: fail loudly if any public FK into auth.users is ───
--        still non-cascading. Without this, a migration that silently
--        did not run leaves the delete broken with no signal.
do $$
declare
  bad record;
  offenders text := '';
begin
  for bad in
    select conrelid::regclass::text as child, conname
    from   pg_constraint
    where  contype = 'f'
      and  connamespace = 'public'::regnamespace
      and  confrelid = 'auth.users'::regclass
      and  confdeltype <> 'c'
  loop
    offenders := offenders || bad.child || '.' || bad.conname || ' ';
  end loop;

  if offenders <> '' then
    raise exception
      'FK(s) into auth.users still not ON DELETE CASCADE: %', offenders;
  end if;
end $$;

commit;
