/**
 * Faz 3: scoring formulas moved to `shared/scoring.ts` so the Edge
 * Function and the client compute identical numbers from a single
 * source. This file used to hold the primary implementation; it now
 * re-exports the shared module and adds the client-only helpers that
 * the Edge Function has no reason to run (weekly bar chart
 * aggregation).
 *
 * The `Outcome` union changed from `'resisted' | 'gave_in'` to
 * `'resisted' | 'failed'` in this phase to match the DB rename.
 */

import { daysBetween, localDayKey, type Outcome } from '@/shared/scoring';

export {
  applyOutcome,
  calculateResistPoints,
  daysBetween,
  failurePenalty,
  localDayKey,
  nextMomentum,
  nextStreak,
  FAILURE_PENALTY_MAX,
  FAILURE_PENALTY_PCT,
  MAX_SESSION_MINUTES,
  RATE_LIMIT_MAX_PER_HOUR,
} from '@/shared/scoring';
export type { Outcome, SessionStatus } from '@/shared/scoring';

/**
 * Reduce a list of resolved sessions into a 7-element array of resist
 * counts for the last seven LOCAL calendar days. Index 0 is six days
 * ago; index 6 is today. `nowMs` is configurable so this stays a pure
 * function — pass Date.now() in production, a fixed timestamp in
 * tests.
 *
 * Client-only: the Edge Function has no reason to shape the weekly
 * bar chart, so this stays out of shared/.
 */
export function weeklyResistCounts(args: {
  sessions: ReadonlyArray<{ outcome: Outcome; createdAt: number }>;
  nowMs: number;
}): number[] {
  const today = localDayKey(args.nowMs);
  const counts = new Array(7).fill(0) as number[];
  for (const s of args.sessions) {
    if (s.outcome !== 'resisted') continue;
    const day = localDayKey(s.createdAt);
    const delta = daysBetween(day, today);
    if (delta < 0 || delta > 6) continue;
    counts[6 - delta] += 1;
  }
  return counts;
}
