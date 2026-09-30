-- 017_grant_hardening.sql
--
-- Follow-ups from the 2026-09-29 security review (Supabase Security Advisor).
-- Two cheap "close the unnecessary open door" fixes. Neither is an exploitable
-- hole today — they are defense-in-depth / advisor-clean-up.
--
-- Idempotent. Apply via the Management API query endpoint (this project is
-- not managed through `supabase db push`; see 015's note).

begin;

------------------------------------------------------------
-- 1. Revoke EXECUTE on the internal trigger functions.
--
--    handle_new_user() and rls_auto_enable() are SECURITY DEFINER functions
--    meant to run ONLY as triggers. PostgreSQL grants EXECUTE to PUBLIC by
--    default, so the advisor flags them as directly callable by anon /
--    authenticated. Triggers fire regardless of EXECUTE grants, so removing
--    the grant is a no-op for normal operation — it just closes the door on
--    anyone invoking a definer function by hand.
------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

------------------------------------------------------------
-- 2. Belt-and-suspenders: revoke SELECT on feedback + rate_limits.
--
--    These tables are only ever touched server-side (edge functions with the
--    service_role key, and the SECURITY DEFINER bump_rate_limit function).
--    RLS is already ON with no policy, so clients already read nothing. This
--    also drops the SELECT grant itself, so even if RLS were ever accidentally
--    turned off, anon/authenticated still could not read rows.
------------------------------------------------------------
revoke select on table public.feedback   from anon, authenticated;
revoke select on table public.rate_limits from anon, authenticated;

------------------------------------------------------------
-- Verifier.
------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'handle_new_user still EXECUTE-able by anon/authenticated';
  end if;

  if has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') then
    raise exception 'rls_auto_enable still EXECUTE-able by anon/authenticated';
  end if;

  if has_table_privilege('anon', 'public.feedback', 'SELECT')
     or has_table_privilege('authenticated', 'public.feedback', 'SELECT') then
    raise exception 'feedback still SELECT-able by anon/authenticated';
  end if;

  if has_table_privilege('anon', 'public.rate_limits', 'SELECT')
     or has_table_privilege('authenticated', 'public.rate_limits', 'SELECT') then
    raise exception 'rate_limits still SELECT-able by anon/authenticated';
  end if;

  raise notice 'grant hardening verified';
end $$;

commit;
