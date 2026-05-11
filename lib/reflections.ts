import { supabase } from './supabase';

/**
 * Reflection journal: a short, private note the user can leave after a
 * resist or a gave_in. Unlike community posts these are owner-only; the
 * reflection lives next to the craving session that prompted it so the
 * profile can later show a timeline of "what was going on".
 *
 * NOTE — additive migration required before this hits production:
 *
 *   CREATE TABLE IF NOT EXISTS reflections (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *     session_id uuid REFERENCES craving_sessions(id) ON DELETE SET NULL,
 *     addiction_id text NOT NULL,
 *     outcome text NOT NULL CHECK (outcome IN ('resisted', 'gave_in')),
 *     note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 500),
 *     created_at timestamptz NOT NULL DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS reflections_user_created_idx
 *     ON reflections (user_id, created_at DESC);
 *   ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "owner_all" ON reflections
 *     FOR ALL TO authenticated
 *     USING (user_id = auth.uid())
 *     WITH CHECK (user_id = auth.uid());
 *
 * addiction_id + outcome are SNAPSHOTTED at write time (not derived via
 * a join) — the session FK is nullable + ON DELETE SET NULL so deleting
 * a session doesn't strand the reflection without context. The note
 * itself is intentionally Update-locked at the type level; editing a
 * past reflection erodes its honesty (delete + re-add if you really
 * want a do-over).
 */

export const REFLECTION_MIN_LEN = 1;
export const REFLECTION_MAX_LEN = 500;

export type Reflection = {
  id: string;
  user_id: string;
  session_id: string | null;
  addiction_id: string;
  outcome: 'resisted' | 'gave_in';
  note: string;
  created_at: string;
};

export async function createReflection(input: {
  userId: string;
  sessionId: string | null;
  addictionId: string;
  outcome: 'resisted' | 'gave_in';
  note: string;
}): Promise<{ id: string }> {
  const trimmed = input.note.trim();
  if (
    trimmed.length < REFLECTION_MIN_LEN ||
    trimmed.length > REFLECTION_MAX_LEN
  ) {
    throw new Error(
      `Not ${REFLECTION_MIN_LEN}-${REFLECTION_MAX_LEN} karakter olmalı.`
    );
  }
  const { data, error } = await supabase
    .from('reflections')
    .insert({
      user_id: input.userId,
      session_id: input.sessionId,
      addiction_id: input.addictionId,
      outcome: input.outcome,
      note: trimmed,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

/** Newest first. Used by the profile timeline (future iteration). */
export async function fetchRecentReflections(
  userId: string,
  limit = 30
): Promise<Reflection[]> {
  const { data, error } = await supabase
    .from('reflections')
    .select('id, user_id, session_id, addiction_id, outcome, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Reflection[];
}
