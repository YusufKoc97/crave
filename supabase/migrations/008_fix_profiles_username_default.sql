-- 008_fix_profiles_username_default.sql
--
-- Fixes a critical production bug: every new signup was failing with
-- `duplicate key value violates unique constraint "profiles_username_key"`.
--
-- ROOT CAUSE (confirmed against production, project scdedlhpbcddoqphauxo)
-- `profiles.username` was `NOT NULL DEFAULT ''`. The `handle_new_user`
-- trigger never sets `username` itself — it only inserts `(id,
-- onboarding_completed)` — so every signup fell through to that
-- column default. The FIRST signup ever to hit it claimed the empty
-- string; every signup since has collided with it on the UNIQUE
-- constraint. New user acquisition was completely broken until this
-- ran.
--
-- This was a schema/code mismatch, not a trigger bug: the app's own
-- TypeScript schema (lib/supabase.ts) already types `username` as
-- `string | null`, and lib/profile.ts's `getUsername()` already
-- treats a missing handle as `null` (`data?.username ?? null`). The
-- column just never actually allowed that — this migration makes the
-- schema match the contract the app already assumes.
--
-- FIX
-- Make the column nullable with no default, and heal the one bad row.
-- A plain UNIQUE constraint in Postgres does NOT consider NULLs equal
-- to each other, so any number of profiles can have username = NULL
-- without colliding — no constraint change needed.
--
-- Idempotent — safe to run again.

begin;

alter table public.profiles alter column username drop not null;
alter table public.profiles alter column username drop default;

update public.profiles set username = null where username = '';

-- Verifier: fail loudly if anything is still using the empty-string
-- sentinel, or if the column somehow reverted to NOT NULL.
do $$
begin
  if exists (select 1 from public.profiles where username = '') then
    raise exception 'profiles still has empty-string username rows';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'username' and is_nullable = 'NO'
  ) then
    raise exception 'profiles.username is still NOT NULL';
  end if;
end $$;

commit;
