import { t } from '@/lib/i18n';
import { RANK_LADDER as SHARED_LADDER, type RankRow } from '@/shared/ranks';

/**
 * Client-side wrapper around the shared 9-rank ladder. The ids +
 * threshold numbers live in `shared/ranks.ts` so the Edge Function
 * and the client agree byte-for-byte; this file adds the display
 * layer (i18n-resolved name + description).
 *
 * Every threshold in this ladder is a tuning knob — after Faz 4
 * ships and real user data lands, expect to recalibrate. Update
 * numbers in `shared/ranks.ts` and both sides pick them up.
 */

export type Rank = RankRow & {
  /** i18n-resolved display name (e.g. "First Step"). */
  name: string;
  /** i18n-resolved one-liner shown under the name. */
  description: string;
};

export function toRank(row: RankRow): Rank {
  return {
    ...row,
    name: t(`ranks.${row.id}.name`),
    description: t(`ranks.${row.id}.description`),
  };
}

/** Full display-ready ladder in ascending order. */
export const RANK_LADDER: readonly Rank[] = SHARED_LADDER.map(toRank);

// Re-export the pure helpers so callers don't have to reach into
// two modules to plot a rank badge.
export {
  currentRankFromUnlocks,
  nextRankAfter,
  newlyUnlockedRanks,
  progressWithinRank,
  ranksReachedAt,
} from '@/shared/ranks';
export type { RankRow } from '@/shared/ranks';
