import { supabase } from './supabase';
import type {
  TechniqueContext,
  TechniqueFeedback,
} from '@/constants/toolkitCatalog';

/**
 * Faz 6 — client-side CRUD over `technique_uses`.
 *
 * Two-write lifecycle per invocation:
 *   1. `logTechniqueStart` on Start → INSERT a row (returns id).
 *   2. `logTechniqueEnd`   on quit/completion + feedback → UPDATE
 *                            the same row with `completed` +
 *                            optional `feedback`.
 *
 * All writes are best-effort. Losing telemetry never blocks the UX
 * — the guided flow proceeds either way. RLS scopes every row to
 * the caller via `user_id = auth.uid()`.
 */

export type LogStartInput = {
  userId: string;
  techniqueId: string;
  context: TechniqueContext;
  /** Only for context = 'active_craving' — links the technique
   *  use back to the specific craving that prompted it. */
  sessionId?: string | null;
  /** Filled by both contexts: info_tab launches carry the
   *  addiction whose landing page they came from; active_craving
   *  launches carry the addiction on the timer screen. Null =
   *  "unknown context" (shouldn't happen in the current UI). */
  addictionId?: string | null;
};

/**
 * INSERT a fresh row when the guided flow starts. Returns the row
 * id so the caller can UPDATE it later. Returns null on failure so
 * the caller can render the guide even offline — telemetry loss is
 * acceptable; UX interruption isn't.
 */
export async function logTechniqueStart(
  input: LogStartInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from('technique_uses')
    .insert({
      user_id: input.userId,
      technique_id: input.techniqueId,
      context: input.context,
      addiction_id: input.addictionId ?? null,
      session_id: input.sessionId ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

export type LogEndInput = {
  useId: string;
  completed: boolean;
  feedback: TechniqueFeedback | null;
};

/**
 * UPDATE the row when the flow ends (either fully completed or
 * quit early via ×). `feedback` may still be null if the user
 * skipped the rating.
 */
export async function logTechniqueEnd(input: LogEndInput): Promise<void> {
  await supabase
    .from('technique_uses')
    .update({ completed: input.completed, feedback: input.feedback })
    .eq('id', input.useId);
  // Failures are silent — telemetry, not scoring.
}
