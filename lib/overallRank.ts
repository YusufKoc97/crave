import {
  RANK_LADDER,
  nextRankAfter,
  ranksReachedAt,
  type RankRow,
} from '@/shared/ranks';
import { toRank, type Rank } from '@/constants/rankLadder';

/**
 * Cross-addiction rank projection for the Profile screen hero card.
 *
 * The per-addiction rank system in `shared/ranks.ts` already defines
 * a 9-step ladder (traveler → free) tied to a single addiction's
 * score. For the Profile "overall rank" we deliberately reuse that
 * same ladder against the user's total points across all addictions
 * (design decision: no new schema, ids stay reusable, i18n covered).
 *
 * Semantics differ subtly from per-addiction rank: there is no
 * unlock table for the overall projection, so we take the *highest
 * threshold the score currently reaches* (i.e. it's momentum-based,
 * not the "highest ever unlocked" semantic per-addiction uses).
 * This is fine for a display-only summary and avoids a schema for
 * a screen that has no gameplay consequence.
 */

export type OverallRankSnapshot = {
  current: Rank;
  next: Rank | null;
  /** 0..1 through the current rank's band. 1 when at ceiling. */
  progress: number;
  /** Points needed to reach the next rank; null at ceiling. */
  pointsToNext: number | null;
};

export function overallRankFromTotalPoints(
  totalPoints: number
): OverallRankSnapshot {
  const reached = ranksReachedAt(totalPoints);
  const currentRow: RankRow = reached[reached.length - 1] ?? RANK_LADDER[0];
  const nextRow = nextRankAfter(currentRow);
  const span = nextRow
    ? Math.max(1, nextRow.thresholdScore - currentRow.thresholdScore)
    : 1;
  const covered = Math.max(0, totalPoints - currentRow.thresholdScore);
  const progress = nextRow ? Math.min(1, covered / span) : 1;
  return {
    current: toRank(currentRow),
    next: nextRow ? toRank(nextRow) : null,
    progress,
    pointsToNext: nextRow
      ? Math.max(0, nextRow.thresholdScore - totalPoints)
      : null,
  };
}
