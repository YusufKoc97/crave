/**
 * Cross-runtime rank ladder — pure TypeScript with no runtime imports
 * so both Vitest (Node) and the Deno-based Edge Function pull it in
 * from a single source. Same principle as shared/scoring.ts.
 *
 * KEEP IN SYNC WITH `constants/rankLadder.ts` (client-side wrapper
 * that adds the i18n-facing names).
 *
 * Threshold semantics:
 *   - score >= threshold → rank is UNLOCKABLE at that score
 *   - Unlock is one-way: a row in user_unlocked_ranks is written the
 *     first time a user crosses the threshold, and stays forever
 *     even if the user's score later dips below it (failure
 *     penalty). Regression is treated as "score dropped" in the UI,
 *     not "rank lost".
 *
 * Thresholds are tuning knobs — after Faz 4 ships and real usage
 * data lands, expect these to be recalibrated. Both files (this and
 * constants/rankLadder.ts) must be updated together.
 */

export type RankRow = {
  id: string;
  order: number;
  thresholdScore: number;
};

export const RANK_LADDER: readonly RankRow[] = [
  { id: 'traveler', order: 1, thresholdScore: 0 },
  { id: 'first_step', order: 2, thresholdScore: 100 },
  { id: 'steady', order: 3, thresholdScore: 400 },
  { id: 'persistent', order: 4, thresholdScore: 1000 },
  { id: 'disciplined', order: 5, thresholdScore: 2500 },
  { id: 'aware', order: 6, thresholdScore: 6000 },
  { id: 'master', order: 7, thresholdScore: 15000 },
  { id: 'expert', order: 8, thresholdScore: 35000 },
  { id: 'free', order: 9, thresholdScore: 75000 },
] as const;

/**
 * All ranks the caller has *earned* at this score — anything with a
 * threshold <= score. Returned in ascending order.
 *
 * The Edge Function passes this list to a diff against
 * `user_unlocked_ranks` to figure out which rows need INSERTing on
 * this resolve.
 */
export function ranksReachedAt(score: number): RankRow[] {
  return RANK_LADDER.filter((r) => score >= r.thresholdScore);
}

/**
 * The `newly_unlocked_ranks` payload for the resolve-craving
 * response: any rank the score crossed on THIS resolve that wasn't
 * unlocked before it. Returns rank ids in ascending threshold order
 * so the client can animate them one after the other.
 */
export function newlyUnlockedRanks(args: {
  previousScore: number;
  newScore: number;
  alreadyUnlocked: ReadonlySet<string>;
}): string[] {
  // Only positive score jumps can unlock — failures can drop below a
  // threshold but never above one.
  if (args.newScore <= args.previousScore) return [];
  const wasAt = new Set(ranksReachedAt(args.previousScore).map((r) => r.id));
  const nowAt = ranksReachedAt(args.newScore);
  return nowAt
    .filter((r) => !wasAt.has(r.id) && !args.alreadyUnlocked.has(r.id))
    .map((r) => r.id);
}

/**
 * "Current rank" for a user = the highest rank they've ever
 * unlocked, NOT the highest their current score reaches. Faz 4
 * decision: unlocks are permanent, so a failure that drops their
 * score below a previously-crossed threshold does not demote them.
 * Falls back to the ladder floor (order 1) when no unlocks exist.
 */
export function currentRankFromUnlocks(
  unlockedIds: ReadonlySet<string>
): RankRow {
  const floor = RANK_LADDER[0];
  let best: RankRow = floor;
  for (const row of RANK_LADDER) {
    if (unlockedIds.has(row.id) && row.order > best.order) {
      best = row;
    }
  }
  return best;
}

/**
 * The next rank on the ladder above `current`, or null when the user
 * is already at rank 9 ("Free"). Used to render the "next milestone"
 * hint below the journey bar.
 */
export function nextRankAfter(current: RankRow): RankRow | null {
  const idx = RANK_LADDER.findIndex((r) => r.id === current.id);
  if (idx < 0) return null;
  return RANK_LADDER[idx + 1] ?? null;
}

/**
 * Progress fraction (0..1) between current rank threshold and the
 * next one. 1 when the user has already hit the ladder ceiling.
 * Clamped so ceiling scores don't overshoot past the segment.
 */
export function progressWithinRank(args: {
  score: number;
  current: RankRow;
}): number {
  const next = nextRankAfter(args.current);
  if (!next) return 1;
  const span = next.thresholdScore - args.current.thresholdScore;
  if (span <= 0) return 1;
  const covered = args.score - args.current.thresholdScore;
  return Math.max(0, Math.min(1, covered / span));
}
