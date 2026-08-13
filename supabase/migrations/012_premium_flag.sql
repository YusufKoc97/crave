------------------------------------------------------------
-- 012 — Premium entitlement flag on profiles
--
-- Single server-readable source of truth for "is this user premium".
-- Today every row is false, so no live behaviour changes on deploy.
-- When the paywall ships, RevenueCat's webhook flips this column and
-- every SERVER-SIDE gate reads it with no further code change:
--   * resolve-craving  → Streak Protection (halve streak on give-in
--                        instead of resetting to 0)
--   * community comparison aggregation (later)
--
-- Client-side UI gates (Profile history window, Trigger insight blur)
-- read the lib/premium.ts `useIsPremium()` hook instead — this column
-- exists for the Edge Functions, which cannot see that hook.
------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
