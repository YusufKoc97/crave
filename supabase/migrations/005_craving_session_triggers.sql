-- Faz 5 — Craving-session trigger capture
--
-- Run in the Supabase SQL Editor. Idempotent; safe to re-run. No
-- CHECK constraint on trigger_id (Faz 5 karar #2 — whitelist lives
-- client-side; DB accepts anything so kalibrasyon değişikliği
-- migration gerektirmez).

CREATE TABLE IF NOT EXISTS craving_session_triggers (
  session_id uuid NOT NULL REFERENCES craving_sessions(id) ON DELETE CASCADE,
  trigger_id text NOT NULL,
  PRIMARY KEY (session_id, trigger_id)
);

-- Modül 3 will slice heatmaps by trigger_id; index the reverse
-- lookup ahead of time.
CREATE INDEX IF NOT EXISTS craving_session_triggers_trigger_idx
  ON craving_session_triggers (trigger_id);

ALTER TABLE craving_session_triggers ENABLE ROW LEVEL SECURITY;

-- Faz 5 karar #3 — client-only persistence. The user reads, inserts,
-- and deletes rows for their OWN sessions; no service-role writer.
-- The subquery guard scopes every policy to sessions the caller
-- already owns (RLS on craving_sessions itself is what really
-- enforces ownership — this JOIN is defense-in-depth).
DROP POLICY IF EXISTS "owner_read" ON craving_session_triggers;
CREATE POLICY "owner_read" ON craving_session_triggers
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM craving_sessions WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owner_insert" ON craving_session_triggers;
CREATE POLICY "owner_insert" ON craving_session_triggers
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM craving_sessions WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owner_delete" ON craving_session_triggers;
CREATE POLICY "owner_delete" ON craving_session_triggers
  FOR DELETE TO authenticated
  USING (
    session_id IN (
      SELECT id FROM craving_sessions WHERE user_id = auth.uid()
    )
  );
