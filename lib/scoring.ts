/**
 * Pure scoring + streak logic. Kept in its own module (no React, no
 * Supabase imports) so it can be unit-tested by Vitest without the
 * react-native runtime, and so the formulas have a single owner.
 *
 *   base   = max(1, round(minutes * sensitivity))    // floor at 1pt
 *   bonus  = sensitivity * 5 * completedCycles       // each full cycle
 *   total  = base + bonus                            // 0 if gave_in
 */

export type Outcome = 'resisted' | 'gave_in';

export type ScoringInput = {
  outcome: Outcome;
  durationSeconds: number;
  sensitivity: number;
  completedCycles: number;
};

export function calculateResistPoints(input: ScoringInput): number {
  if (input.outcome !== 'resisted') return 0;
  const minutes = input.durationSeconds / 60;
  const base = Math.max(1, Math.round(minutes * input.sensitivity));
  const bonus = input.sensitivity * 5 * input.completedCycles;
  return base + bonus;
}

/** Local-time YYYY-MM-DD key for grouping sessions by calendar day. */
export function localDayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole calendar days from `from` to `to` (negative if from is later). */
export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * "Consecutive days with >=1 resist" streak. Pass the most recent prior
 * resist day (null = no prior), today's day key, and the current streak;
 * returns what the streak should be after recording another resist now.
 *
 *   same day as last resist → no bump (already counted today)
 *   exactly 1 day later      → streak + 1
 *   any other gap or none    → streak reset to 1 (a new chain begins)
 */
export function nextStreak(args: {
  lastResistDay: string | null;
  today: string;
  currentStreak: number;
}): number {
  if (args.lastResistDay === args.today) return args.currentStreak;
  if (
    args.lastResistDay &&
    daysBetween(args.lastResistDay, args.today) === 1
  ) {
    return args.currentStreak + 1;
  }
  return 1;
}
