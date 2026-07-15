import { supabase } from './supabase';

/**
 * Faz 5 — client-side CRUD over `craving_session_triggers`.
 *
 * Trigger persistence is client-only (karar #3): the Edge Function
 * doesn't touch this table. The RLS policies scope every operation
 * to sessions the caller already owns.
 *
 * Failure modes are non-fatal on purpose. The craving session is
 * always more important than the trigger metadata — if a network
 * drop wipes the INSERT, the session still resolves and Modül 3
 * just gets one row with no triggers. Callers should await these
 * for the happy-path telemetry but never block UI on them.
 */

/**
 * Persist the initial trigger selection when a session starts.
 * Batches all rows in one INSERT so a partial write is unlikely.
 */
export async function insertSessionTriggers(
  sessionId: string,
  triggerIds: readonly string[]
): Promise<void> {
  if (triggerIds.length === 0) return;
  const rows = triggerIds.map((trigger_id) => ({
    session_id: sessionId,
    trigger_id,
  }));
  const { error } = await supabase
    .from('craving_session_triggers')
    .insert(rows);
  if (error) throw error;
}

/**
 * Replace the trigger set for a session — used when the user
 * revises their selection in the failure-confirmation modal.
 * DELETE + INSERT rather than a diff because the row count is
 * tiny (≤ ~16) and the two-statement path is easier to reason
 * about than partial updates.
 */
export async function replaceSessionTriggers(
  sessionId: string,
  triggerIds: readonly string[]
): Promise<void> {
  const del = await supabase
    .from('craving_session_triggers')
    .delete()
    .eq('session_id', sessionId);
  if (del.error) throw del.error;
  await insertSessionTriggers(sessionId, triggerIds);
}

/**
 * Fetch the trigger ids captured for a session — used when the
 * failure-confirmation modal pre-selects the chips the user
 * originally chose. Returns [] on error rather than throwing so
 * the modal still opens with an empty selection and lets the user
 * repopulate manually.
 */
export async function fetchSessionTriggers(
  sessionId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('craving_session_triggers')
    .select('trigger_id')
    .eq('session_id', sessionId);
  if (error || !data) return [];
  return data.map((r) => r.trigger_id);
}
