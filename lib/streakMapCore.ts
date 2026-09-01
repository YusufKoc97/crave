/**
 * Streak Map — pure fold (no React / RN / Supabase imports).
 *
 * Kept RN-free on purpose so Vitest can exercise the streak maths
 * directly (see `tests/streakMap.test.ts`), the same split
 * `shared/comparisonStats.ts` uses. The hook that wraps this and does
 * the Supabase read lives in `lib/streakMap.ts`.
 *
 * WHAT THIS PRODUCES: a GitHub-contribution-graph-style day array plus
 * the derived current / best streak and the index ranges the panel
 * rings highlight.
 *
 * STREAK SEMANTICS — day-based, but deliberately NOT the naive
 * "any quiet day breaks the streak" rule the app retired (a
 * craving-free day used to reset it, which read as punishment for a
 * good day):
 *   - A day is a *give-in* if it carries ≥1 'failed' outcome.
 *   - currentStreak = calendar days since the last give-in, up to and
 *     including today. Craving-free (empty) days do NOT break it —
 *     they are bridged.
 *   - bestStreak = the longest give-in-free calendar run in history.
 * The grid still colours each day by how many cravings were resisted
 * (level 0..4); the streak count and ring highlights come from the
 * give-in boundaries, not from the density.
 *
 * This is the day-based reading of "streak"; the event-based
 * `profiles.streak` medallion on the Lifetime panel is a separate,
 * intentionally different number.
 */

export type StreakLevel = 0 | 1 | 2 | 3 | 4;

export type StreakDay = {
  /** Local-midnight epoch ms for the calendar day. */
  dateMs: number;
  /** Density = cravings resisted that day, clamped to 0..4 (for colour). */
  level: StreakLevel;
  /** Exact cravings resisted that day, unclamped (for the tap caption). */
  resisted: number;
  /** The day carried at least one give-in (a 'failed' outcome). */
  giveIn: boolean;
};

/** Inclusive index range into `days`. */
export type StreakRange = { start: number; end: number };

export type StreakMap = {
  /** Chronological, first-active day → today, every calendar day filled. */
  days: StreakDay[];
  /** Total resolved sessions — drives the empty/lowdata state gate. */
  recordCount: number;
  currentStreak: number;
  bestStreak: number;
  bestRange: StreakRange | null;
  currentRange: StreakRange | null;
};

export type StreakSessionRow = {
  outcome: string | null;
  created_at: string;
};

function localMidnight(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function clampLevel(resisted: number): StreakLevel {
  if (resisted <= 0) return 0;
  if (resisted >= 4) return 4;
  return resisted as StreakLevel;
}

const EMPTY: StreakMap = {
  days: [],
  recordCount: 0,
  currentStreak: 0,
  bestStreak: 0,
  bestRange: null,
  currentRange: null,
};

/**
 * Fold a user's whole resolved-session history into the day map.
 * `nowMs` is injected so the result is deterministic under test.
 */
export function computeStreakMap(
  rows: StreakSessionRow[],
  nowMs: number
): StreakMap {
  if (!rows || rows.length === 0) return EMPTY;

  // Tally resisted / give-in counts per local calendar day.
  const perDay = new Map<number, { resisted: number; failed: number }>();
  let earliest = Infinity;
  let recordCount = 0;
  for (const r of rows) {
    const ts = Date.parse(r.created_at);
    if (Number.isNaN(ts)) continue;
    recordCount += 1;
    const key = localMidnight(ts);
    if (key < earliest) earliest = key;
    const bucket = perDay.get(key) ?? { resisted: 0, failed: 0 };
    if (r.outcome === 'resisted') bucket.resisted += 1;
    else if (r.outcome === 'failed') bucket.failed += 1;
    perDay.set(key, bucket);
  }
  if (recordCount === 0 || earliest === Infinity) return EMPTY;

  // Walk calendar days first→today. A Date cursor (not fixed-ms
  // stepping) keeps DST shifts and month rollovers correct.
  const todayKey = localMidnight(nowMs);
  const days: StreakDay[] = [];
  const cursor = new Date(earliest);
  const endKey = new Date(todayKey).getTime();
  // Guard against a future-dated earliest row (clock skew): never
  // iterate backwards past today.
  while (cursor.getTime() <= endKey) {
    const key = cursor.getTime();
    const b = perDay.get(key);
    const resisted = b ? b.resisted : 0;
    const giveIn = !!b && b.failed > 0;
    const level = giveIn ? 0 : clampLevel(resisted);
    days.push({ dateMs: key, level, resisted, giveIn });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Best run: longest give-in-free stretch; empties are bridged.
  let bestRange: StreakRange | null = null;
  let runStart = 0;
  for (let i = 0; i <= days.length; i++) {
    const isBreak = i === days.length || days[i].giveIn;
    if (isBreak) {
      const runLen = i - runStart;
      const bestLen = bestRange ? bestRange.end - bestRange.start + 1 : 0;
      if (runLen > 0 && runLen > bestLen) {
        bestRange = { start: runStart, end: i - 1 };
      }
      runStart = i + 1;
    }
  }

  // Current run: the trailing give-in-free stretch, ending today.
  let curStart = days.length;
  for (let i = days.length - 1; i >= 0 && !days[i].giveIn; i--) curStart = i;
  const currentRange =
    curStart < days.length ? { start: curStart, end: days.length - 1 } : null;

  return {
    days,
    recordCount,
    currentStreak: currentRange ? currentRange.end - currentRange.start + 1 : 0,
    bestStreak: bestRange ? bestRange.end - bestRange.start + 1 : 0,
    bestRange,
    currentRange,
  };
}
