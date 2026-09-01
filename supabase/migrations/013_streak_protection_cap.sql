-- 013_streak_protection_cap.sql
--
-- Monthly cap for the premium "Streak Protection" perk. Previously a
-- premium user could soften unlimited give-ins (streak → half instead of
-- 0), which drains the streak of meaning. We now allow a fixed number of
-- protections per calendar month (see STREAK_PROTECTION_MONTHLY_CAP in
-- shared/scoring.ts).
--
-- Two columns track usage, written ONLY by the resolve-craving Edge
-- Function (service role). The client never authors them.
--   streak_protection_period : the 'YYYY-MM' the counter belongs to.
--                              NULL = never used. When the current month
--                              differs from this, the count resets to 0
--                              without needing a scheduled job.
--   streak_protection_used   : protections consumed within that period.
--
-- Additive, backfilled with a safe default; no lock-heavy rewrite.
alter table public.profiles
  add column if not exists streak_protection_period text,
  add column if not exists streak_protection_used integer not null default 0;
