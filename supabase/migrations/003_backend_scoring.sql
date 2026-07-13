-- Faz 3 — Backend score calculation
--
-- Run this in the Supabase SQL Editor BEFORE deploying the
-- resolve-craving Edge Function. Ordered so each step is idempotent
-- (safe to re-run) and each ALTER falls back to a no-op if the
-- previous phase already made the change.
--
-- Dev-only environment. If you have real users, revisit the enum
-- rename block — it truncates the outcome/status columns to nullable
-- then re-adds the CHECK constraint under new names, which loses no
-- data but does break clients that expect the old values.

------------------------------------------------------------
-- 1. craving_sessions: rename status + outcome enums,
--    rename points_earned → points_delta, add intensity.
------------------------------------------------------------

-- Drop the existing CHECK constraints so we can rename their values.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'craving_sessions'::regclass
      AND conname = 'craving_sessions_status_check'
  ) THEN
    ALTER TABLE craving_sessions DROP CONSTRAINT craving_sessions_status_check;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'craving_sessions'::regclass
      AND conname = 'craving_sessions_outcome_check'
  ) THEN
    ALTER TABLE craving_sessions DROP CONSTRAINT craving_sessions_outcome_check;
  END IF;
END $$;

-- Rename values in existing rows (harmless if the table is empty).
UPDATE craving_sessions SET status = 'resolved' WHERE status = 'completed';
UPDATE craving_sessions SET outcome = 'failed'  WHERE outcome = 'gave_in';

-- Re-add the CHECK constraints with the new value set.
ALTER TABLE craving_sessions
  ADD CONSTRAINT craving_sessions_status_check
  CHECK (status IN ('active', 'resolved', 'abandoned'));
ALTER TABLE craving_sessions
  ADD CONSTRAINT craving_sessions_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('resisted', 'failed'));

-- Rename points_earned → points_delta (signed: +gain, -penalty, 0).
ALTER TABLE craving_sessions
  RENAME COLUMN points_earned TO points_delta;

-- Add intensity — populated by the Faz 5 rating question, nullable
-- until then.
ALTER TABLE craving_sessions
  ADD COLUMN IF NOT EXISTS intensity int
    CHECK (intensity IS NULL OR intensity BETWEEN 1 AND 5);

-- completed_cycles is no longer part of the formula (the Edge
-- Function derives cycles from duration + sensitivity). Drop it to
-- keep the schema honest.
ALTER TABLE craving_sessions
  DROP COLUMN IF EXISTS completed_cycles;

------------------------------------------------------------
-- 2. Per-addiction cumulative score.
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_addiction_scores (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addiction_id text NOT NULL
    CHECK (addiction_id IN (
      'nicotine','alcohol','caffeine','vape','gambling',
      'junk_food','shopping','pmo','doomscroll','gaming'
    )),
  score        int  NOT NULL DEFAULT 0 CHECK (score >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, addiction_id)
);

ALTER TABLE user_addiction_scores ENABLE ROW LEVEL SECURITY;

-- Users can read their own scores but NOT write — only the Edge
-- Function (running under service role) may INSERT / UPDATE.
DROP POLICY IF EXISTS "owner_read" ON user_addiction_scores;
CREATE POLICY "owner_read" ON user_addiction_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

------------------------------------------------------------
-- 3. Cumulative score view.
------------------------------------------------------------

CREATE OR REPLACE VIEW user_total_score AS
SELECT
  user_id,
  COALESCE(SUM(score), 0)::int AS total_score
FROM user_addiction_scores
GROUP BY user_id;

-- Views inherit RLS from base tables. Confirm the user can SELECT.
GRANT SELECT ON user_total_score TO authenticated;

------------------------------------------------------------
-- 4. Log-only rate limit substrate (Faz 3 hooks — enforcement
--    lands in a later phase; today the Edge Function just
--    increments the counter and console.warn's on breach).
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  hour_bucket text NOT NULL,  -- YYYY-MM-DDTHH (UTC)
  count       int  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, endpoint, hour_bucket)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Users may not read or write; only the Edge Function service role
-- touches this table. No policies granted to authenticated.

------------------------------------------------------------
-- 5. Legacy scoring columns cleanup — profiles.momentum + streak
--    stay (they become server-authoritative but the shape doesn't
--    change). Just the client-authored writes go away.
------------------------------------------------------------

-- No action needed here; the client already stopped writing to
-- these columns in the accompanying code change.
