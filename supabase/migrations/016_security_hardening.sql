-- 016_security_hardening.sql
--
-- Follow-ups from the 2026-09-28 full-schema audit. Both items predate
-- version control (they were created in the unversioned 001/002 setup,
-- not in any recent change), and neither is reachable as an exploit
-- today — but both are cheap to make right and keep the schema clean.
--
-- Idempotent. Apply via the Management API query endpoint (this
-- project is not managed through `supabase db push`; see 015's note).

begin;

------------------------------------------------------------
-- 1. handle_new_user: pin the search_path.
--
--    It runs SECURITY DEFINER (it must — it writes public.profiles on
--    signup, fired by the on_auth_user_created trigger on auth.users)
--    but had a MUTABLE search_path, which Supabase's own linter flags
--    ("Function Search Path Mutable"). Its body already schema-qualifies
--    every reference (public.profiles), so pinning the path is a no-op
--    at runtime — it just closes the classic definer search-path
--    injection footgun for good.
------------------------------------------------------------
alter function public.handle_new_user() set search_path = public, pg_catalog;

------------------------------------------------------------
-- 2. Drop the orphaned handle_forum_like_count.
--
--    A leftover from a template: this app has no forum, the function is
--    bound to no trigger, and nothing calls it. Dead code in the schema.
------------------------------------------------------------
drop function if exists public.handle_forum_like_count();

------------------------------------------------------------
-- Verifier.
------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%'
  ) then
    raise exception 'handle_new_user search_path still not pinned';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_forum_like_count'
  ) then
    raise exception 'handle_forum_like_count still present';
  end if;

  raise notice 'security hardening verified';
end $$;

commit;
