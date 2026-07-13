/**
 * Cross-runtime scoring module — pure TypeScript with no runtime imports
 * so both Vitest (Node) and the Deno-based Edge Function can pull it in.
 *
 * Formulas live here and NOWHERE else. The Edge Function is the
 * server-side authority; the client re-imports the same functions only
 * to render optimistic estimates while the network round-trip is in
 * flight. Any change to the numbers happens in ONE file.
 *
 *   base   = round(minutes * sensitivity)              // may be 0 for <1s
 *   cycles = floor(minutes / (sensitivity * 5))
 *   bonus  = cycles * (sensitivity * 5)
 *   total  = base + bonus                              // 'resisted' only
 *
 *   penalty = min(FAILURE_PENALTY_MAX,
 *                 round(currentScore * FAILURE_PENALTY_PCT))
 *   newScore = max(0, currentScore - penalty)          // 'failed' only
 *
 * Enum names match the Faz 3 DB rename (`resisted` / `failed`,
 * `active` / `resolved` / `abandoned`).
 */

/** Session outcome after a resolve. */
export type Outcome = 'resisted' | 'failed';

/** DB status column: only 'resolved' rows are counted in totals. */
export type SessionStatus = 'active' | 'resolved' | 'abandoned';

/** 5% of current score, capped at 200. */
export const FAILURE_PENALTY_PCT = 0.05;
export const FAILURE_PENALTY_MAX = 200;

/** Reject sessions the client claims lasted longer than 24 hours. */
export const MAX_SESSION_MINUTES = 24 * 60;

/** Rate limit: log-only in Faz 3; enforced in a later phase. */
export const RATE_LIMIT_MAX_PER_HOUR = 20;

export type ResistPointsInput = {
  outcome: Outcome;
  durationSeconds: number;
  sensitivity: number;
};

/**
 * Compute the point delta for a 'resisted' session.
 *
 * Failure returns 0 here — the actual score deduction happens through
 * `failurePenalty()` because it depends on the user's current score.
 *
 * The cycle count is derived from duration + sensitivity so callers
 * can't fabricate a higher number to inflate the bonus. Each cycle is
 * (sensitivity * 5) minutes wide; a longer session at low sensitivity
 * fits more cycles than the same duration at high sensitivity.
 */
export function calculateResistPoints(input: ResistPointsInput): number {
  if (input.outcome !== 'resisted') return 0;
  const minutes = input.durationSeconds / 60;
  const sensitivity = input.sensitivity;
  const base = Math.round(minutes * sensitivity);
  const cycleLength = sensitivity * 5;
  const cyclesCompleted =
    cycleLength > 0 ? Math.floor(minutes / cycleLength) : 0;
  const bonus = cyclesCompleted * cycleLength;
  return base + bonus;
}

/**
 * Compute the deduction on a 'failed' outcome. Returns a positive
 * number — the caller subtracts it, clamping the resulting score at 0.
 */
export function failurePenalty(currentScore: number): number {
  if (currentScore <= 0) return 0;
  const raw = Math.round(currentScore * FAILURE_PENALTY_PCT);
  return Math.min(FAILURE_PENALTY_MAX, Math.max(0, raw));
}

/**
 * Apply either a resist or a failure to a starting score. Convenience
 * for tests and for the Edge Function's single-column UPSERT. Returns
 * both the new score and the signed delta so callers can persist the
 * delta on the session row without recomputing.
 */
export function applyOutcome(args: {
  currentScore: number;
  outcome: Outcome;
  durationSeconds: number;
  sensitivity: number;
}): { newScore: number; delta: number } {
  if (args.outcome === 'resisted') {
    const gained = calculateResistPoints({
      outcome: 'resisted',
      durationSeconds: args.durationSeconds,
      sensitivity: args.sensitivity,
    });
    return { newScore: args.currentScore + gained, delta: gained };
  }
  const penalty = failurePenalty(args.currentScore);
  return {
    newScore: Math.max(0, args.currentScore - penalty),
    // Force to +0 when penalty is 0 so callers doing strict equality
    // checks (or JSON serialisation) don't see a negative-zero delta.
    delta: penalty === 0 ? 0 : -penalty,
  };
}

/** Momentum reward on a 'resisted' outcome. Capped at 100. */
export function nextMomentum(args: {
  currentMomentum: number;
  durationSeconds: number;
  sensitivity: number;
}): number {
  const minutes = args.durationSeconds / 60;
  const gain = Math.max(
    1,
    Math.min(25, Math.round(args.sensitivity * 1.5 + minutes * 0.4))
  );
  return Math.min(100, args.currentMomentum + gain);
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
 * "Consecutive days with >=1 resist" streak, computed forward from a
 * prior state. See lib/scoring.ts for the client-side history callers
 * still using this shape.
 */
export function nextStreak(args: {
  lastResistDay: string | null;
  today: string;
  currentStreak: number;
}): number {
  if (args.lastResistDay === args.today) return args.currentStreak;
  if (args.lastResistDay && daysBetween(args.lastResistDay, args.today) === 1) {
    return args.currentStreak + 1;
  }
  return 1;
}
