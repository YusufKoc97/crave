-- Faz 6 — Craving Toolkit invocation log
--
-- Run in Supabase SQL Editor. Idempotent; safe to re-run.
--
-- Client-owned RLS — no service-role writer, the Edge Function
-- doesn't touch this table. Users INSERT on technique start and
-- UPDATE on completion/feedback via the same row id.

CREATE TABLE IF NOT EXISTS technique_uses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  technique_id text NOT NULL,
  -- Where in the app the launch happened. 'active_craving' = user
  -- reached for it mid-craving from the timer screen; 'info_tab' =
  -- user opened it from the Info → Toolkit sub-tab (preventive /
  -- exploratory).
  context      text NOT NULL CHECK (context IN ('active_craving','info_tab')),
  -- Faz 6 karar #7 — nullable addiction_id so Info-tab launches
  -- still carry the addiction the user was inspecting (Modül 3
  -- effectiveness cross-analysis). Active-craving launches derive
  -- this via session_id JOIN.
  addiction_id text NULL,
  -- Only set for active_craving context. Info-tab launches leave
  -- this null.
  session_id   uuid NULL REFERENCES craving_sessions(id) ON DELETE SET NULL,
  used_at      timestamptz NOT NULL DEFAULT now(),
  completed    boolean NOT NULL DEFAULT false,
  -- Feedback recorded when the user picks a rating or Skips. NULL
  -- distinguishes "hasn't answered yet" from an explicit rating.
  feedback     text CHECK (
    feedback IS NULL OR feedback IN ('much_better','better','same','worse')
  )
);

CREATE INDEX IF NOT EXISTS technique_uses_user_time_idx
  ON technique_uses (user_id, used_at DESC);

ALTER TABLE technique_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read" ON technique_uses;
CREATE POLICY "owner_read" ON technique_uses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_insert" ON technique_uses;
CREATE POLICY "owner_insert" ON technique_uses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_update" ON technique_uses;
CREATE POLICY "owner_update" ON technique_uses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
