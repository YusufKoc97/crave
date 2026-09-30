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

/**
 * Longest duration that still earns points.
 *
 * The timer has no upper bound (app/active-session.tsx), so leaving it
 * running overnight is normal-user reachable — which is why this
 * CLAMPS rather than rejects. Rejecting would 400 an honest user and,
 * worse, strand their pending-finish blob in a permanent retry.
 *
 * 90 minutes is 6x the longest craving the product actually designs
 * for (constants/addictions.ts puts a cycle at 5-15 min), so almost no
 * honest session reaches it. It caps a single award at 650 points
 * (sensitivity 10, after the overtime discount) instead of the 15,800 that 1,440 minutes used to
 * yield — against a top rank of 75,000, the old ceiling let five calls
 * clear the entire ladder. Lowered from 240 (2,600 points) on
 * 2026-09-30: four hours left an unattended phone far too rewarding.
 */
export const MAX_SCORED_MINUTES = 90;

/**
 * Minutes that earn at the full rate. A real craving lasts 5-15 min, so
 * everything an honest session does sits below this line and is scored
 * exactly as before. Past it, each minute counts for OVERTIME_RATE:
 * sitting on a timer is not the same effort as riding out an urge, and
 * at full rate one unattended 90-minute timer paid ~10 real cravings.
 */
export const FULL_RATE_MINUTES = 30;
export const OVERTIME_RATE = 0.5;

/**
 * Real minutes -> minutes that count towards points and cycle bonuses.
 * Clamped at MAX_SCORED_MINUTES first, then discounted past
 * FULL_RATE_MINUTES (90 real minutes score as 60). The client uses the
 * same function for its live counter and cycle flashes.
 */
export function scoredMinutesFor(rawMinutes: number): number {
  const m = Math.min(Math.max(rawMinutes, 0), MAX_SCORED_MINUTES);
  return m <= FULL_RATE_MINUTES
    ? m
    : FULL_RATE_MINUTES + (m - FULL_RATE_MINUTES) * OVERTIME_RATE;
}

/**
 * Ceiling on points earned per (user, addiction) per calendar day.
 *
 * A heavy but realistic day is ~10 resists ≈ 1,500 points, so this is
 * ~3x real peak usage. With it, the top rank takes at least 15 days per
 * addiction — the intended shape of the ladder — instead of being
 * reachable in a single burst.
 */
export const MAX_DAILY_POINTS_PER_ADDICTION = 5000;

/** Resolve calls allowed per user per UTC hour. One per 3 minutes. */
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
  // Clamp, don't reject — an overnight timer is a real user, not an
  // attacker, and rejecting would strand their session. See
  // MAX_SCORED_MINUTES for why the ceiling sits where it does.
  const minutes = scoredMinutesFor(input.durationSeconds / 60);
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
 * Streak model: a "consecutive-resist run". It counts how many cravings
 * you have resisted in a row — NOT calendar days. A craving-free day
 * neither advances nor breaks it, and multiple resists in one day each
 * count. The run is broken only by giving in (see streakAfterGiveIn).
 *
 * This replaces the old day-based streak, which reset to 1 on any
 * missed calendar day — i.e. it punished a user for a day with no
 * craving, the opposite of what a recovery streak should reward.
 */
export function streakAfterResist(currentStreak: number): number {
  return currentStreak + 1;
}

/**
 * How many times Streak Protection may fire per calendar month.
 *
 * ESTIMATE / TUNABLE: 2 is a starting guess, not a validated number.
 * Unlimited protection makes the streak meaningless and undercuts the
 * whole point (rewarding real resistance); zero would be too punishing
 * for a paid perk. Two slips softened per month is forgiving enough to
 * feel premium while a third slip in one month still lands with full
 * weight. Revisit once there is real usage data.
 */
export const STREAK_PROTECTION_MONTHLY_CAP = 2;

/**
 * A 'failed' (gave-in) outcome breaks the consecutive-resist run.
 *
 * Without protection the run resets fully to 0. WITH protection (a
 * premium user who still has a monthly protection left) it keeps HALF,
 * rounded down — the "Streak Protection" perk: a slip still costs
 * something real (so the number stays honest) but is softened rather
 * than wiped. A streak of 1 halves to 0, identical to a reset — no
 * special-casing.
 *
 * `protectionApplied` is the already-decided answer to "should this
 * particular slip be softened?" — it folds in premium status AND the
 * monthly cap. The caller owns that decision (the server counts usage
 * per month, see resolve-craving); this function just applies it, so it
 * stays a pure, testable transform.
 */
export function streakAfterGiveIn(
  currentStreak: number,
  protectionApplied: boolean
): number {
  if (currentStreak <= 0) return 0;
  return protectionApplied ? Math.floor(currentStreak / 2) : 0;
}
