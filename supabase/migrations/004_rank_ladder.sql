-- Faz 4 — Rank ladder unlock tracking
--
-- Run in the Supabase SQL Editor BEFORE re-deploying the updated
-- resolve-craving Edge Function (which starts INSERTing rows here).
-- Idempotent; safe to re-run.

CREATE TABLE IF NOT EXISTS user_unlocked_ranks (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addiction_id text NOT NULL
    CHECK (addiction_id IN (
      'nicotine','alcohol','caffeine','vape','gambling',
      'junk_food','shopping','pmo','doomscroll','gaming'
    )),
  rank_id      text NOT NULL
    CHECK (rank_id IN (
      'traveler','first_step','steady','persistent','disciplined',
      'aware','master','expert','free'
    )),
  unlocked_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, addiction_id, rank_id)
);

ALTER TABLE user_unlocked_ranks ENABLE ROW LEVEL SECURITY;

-- Users read their own unlocks. Only the Edge Function service role
-- INSERTs — no INSERT policy for authenticated. `ON CONFLICT DO
-- NOTHING` semantics come from the PK, so replaying a resolve
-- silently no-ops.
DROP POLICY IF EXISTS "owner_read" ON user_unlocked_ranks;
CREATE POLICY "owner_read" ON user_unlocked_ranks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Index for the profile / Info-tab hydration query
-- (fetch all unlocks per user, ordered by unlock time).
CREATE INDEX IF NOT EXISTS user_unlocked_ranks_user_time_idx
  ON user_unlocked_ranks (user_id, unlocked_at DESC);
