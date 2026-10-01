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

/**
 * Points for the self-reported "craving-free day" bonus (daily check-in).
 *
 * ONE general bonus per finished day, added to the user's total only.
 * The server cannot tell "no craving came" from "a craving came and was
 * never logged", and nobody turns down free points — so the answer is
 * not trusted to be honest. Instead the bonus can never outgrow real
 * work: see CLEAN_DAY_CAP_RATIO.
 */
export const CLEAN_DAY_POINTS = 50;

/**
 * All clean-day bonuses together may never exceed this share of the
 * points earned by actually resisting (sum of user_addiction_scores).
 * Tapping "no cravings" every day with no resists behind it pays nothing;
 * a person who fought hard and whose cravings then faded earns clean days
 * in proportion to that fight (4,000 resist points -> up to 1,000 bonus,
 * i.e. 20 clean days). 0.25 is a judgement call, not a measured number.
 */
export const CLEAN_DAY_CAP_RATIO = 0.25;

/**
 * Bonus points still available under the cap. Penalties lower resist
 * points, so this can drop to 0 again after it was positive — nothing is
 * ever taken back, new bonuses just stop until resists catch up.
 */
export function cleanDayRoom(
  resistPoints: number,
  bonusPoints: number
): number {
  const cap = Math.floor(Math.max(0, resistPoints) * CLEAN_DAY_CAP_RATIO);
  return Math.max(0, cap - Math.max(0, bonusPoints));
}

/** True when one more full clean-day bonus fits under the cap. */
export function canAffordCleanDay(
  resistPoints: number,
  bonusPoints: number
): boolean {
  return cleanDayRoom(resistPoints, bonusPoints) >= CLEAN_DAY_POINTS;
}

/** Furthest back a finished day can still be claimed (offline grace). */
export const CLEAN_DAY_CLAIM_WINDOW_HOURS = 72;

/** `YYYY-MM-DD` shape + a real calendar date (rejects 2026-02-31). */
export function isValidDayKey(day: unknown): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return false;
  }
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * The [start, end) instants of a user's LOCAL calendar day, in epoch ms.
 * `tzOffsetMinutes` is JS `Date#getTimezoneOffset()` — minutes the local
 * clock is BEHIND UTC (UTC+3 → -180). Pure arithmetic so the client, the
 * Edge Function and the tests all agree on which sessions fall in a day.
 */
export function localDayWindow(
  day: string,
  tzOffsetMinutes: number
): { startMs: number; endMs: number } {
  const [y, m, d] = day.split('-').map(Number);
  const startMs = Date.UTC(y, m - 1, d) + tzOffsetMinutes * 60_000;
  return { startMs, endMs: startMs + 86_400_000 };
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
