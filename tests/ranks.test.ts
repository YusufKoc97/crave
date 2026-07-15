import { describe, expect, it } from 'vitest';
import {
  RANK_LADDER,
  currentRankFromUnlocks,
  newlyUnlockedRanks,
  nextRankAfter,
  progressWithinRank,
  ranksReachedAt,
} from '@/shared/ranks';

/**
 * The Edge Function and the client both consume shared/ranks.ts.
 * These tests are the contract — if either side drifts, gate fails
 * here first.
 */

describe('RANK_LADDER', () => {
  it('has exactly 9 ranks', () => {
    expect(RANK_LADDER.length).toBe(9);
  });

  it('is monotonically increasing by order', () => {
    for (let i = 0; i < RANK_LADDER.length; i++) {
      expect(RANK_LADDER[i].order).toBe(i + 1);
    }
  });

  it('is monotonically increasing by threshold', () => {
    for (let i = 1; i < RANK_LADDER.length; i++) {
      expect(RANK_LADDER[i].thresholdScore).toBeGreaterThan(
        RANK_LADDER[i - 1].thresholdScore
      );
    }
  });

  it('carries the canonical rank ids', () => {
    expect(RANK_LADDER.map((r) => r.id)).toEqual([
      'traveler',
      'first_step',
      'steady',
      'persistent',
      'disciplined',
      'aware',
      'master',
      'expert',
      'free',
    ]);
  });
});

describe('ranksReachedAt', () => {
  it('score 0 reaches only Traveler (threshold 0)', () => {
    const reached = ranksReachedAt(0).map((r) => r.id);
    expect(reached).toEqual(['traveler']);
  });

  it('score 99 stays at Traveler (below First Step)', () => {
    const reached = ranksReachedAt(99).map((r) => r.id);
    expect(reached).toEqual(['traveler']);
  });

  it('score 100 unlocks First Step (threshold boundary)', () => {
    const reached = ranksReachedAt(100).map((r) => r.id);
    expect(reached).toEqual(['traveler', 'first_step']);
  });

  it('score 999999 reaches every rank on the ladder', () => {
    expect(ranksReachedAt(999999).length).toBe(RANK_LADDER.length);
  });
});

describe('newlyUnlockedRanks', () => {
  it('empty when score did not move', () => {
    expect(
      newlyUnlockedRanks({
        previousScore: 500,
        newScore: 500,
        alreadyUnlocked: new Set(['traveler', 'first_step', 'steady']),
      })
    ).toEqual([]);
  });

  it('empty when score dropped (failure penalty)', () => {
    expect(
      newlyUnlockedRanks({
        previousScore: 500,
        newScore: 400,
        alreadyUnlocked: new Set(['traveler', 'first_step', 'steady']),
      })
    ).toEqual([]);
  });

  it('single unlock across one threshold', () => {
    // Crossing the First Step threshold (100).
    expect(
      newlyUnlockedRanks({
        previousScore: 80,
        newScore: 120,
        alreadyUnlocked: new Set(['traveler']),
      })
    ).toEqual(['first_step']);
  });

  it('multiple unlocks in a single resolve', () => {
    // Jump from 0 to 1200 crosses First Step (100), Steady (400),
    // and Persistent (1000) in one go.
    expect(
      newlyUnlockedRanks({
        previousScore: 0,
        newScore: 1200,
        alreadyUnlocked: new Set(['traveler']),
      })
    ).toEqual(['first_step', 'steady', 'persistent']);
  });

  it('does not re-unlock a rank the caller already has', () => {
    // Even though the score jump crosses First Step's threshold on
    // paper, the caller says they've already unlocked it.
    expect(
      newlyUnlockedRanks({
        previousScore: 80,
        newScore: 500,
        alreadyUnlocked: new Set(['traveler', 'first_step']),
      })
    ).toEqual(['steady']);
  });

  it('idempotent replay returns []', () => {
    // Same start + end score + same alreadyUnlocked set — no fresh
    // unlocks even on repeated invocation.
    const args = {
      previousScore: 100,
      newScore: 200,
      alreadyUnlocked: new Set(['traveler', 'first_step']),
    };
    expect(newlyUnlockedRanks(args)).toEqual([]);
  });
});

describe('currentRankFromUnlocks (regression semantics)', () => {
  it('returns Traveler when no unlocks (floor)', () => {
    const r = currentRankFromUnlocks(new Set());
    expect(r.id).toBe('traveler');
  });

  it('returns the highest-order unlocked rank', () => {
    const r = currentRankFromUnlocks(
      new Set(['traveler', 'first_step', 'steady'])
    );
    expect(r.id).toBe('steady');
  });

  it('permanent unlock: a set with all ranks always resolves to Free', () => {
    const r = currentRankFromUnlocks(new Set(RANK_LADDER.map((row) => row.id)));
    expect(r.id).toBe('free');
  });

  it('regression scenario — score dropped but rank persists', () => {
    // User was at Persistent (unlocked traveler/first_step/steady/
    // persistent) but their score fell below Steady's threshold.
    // Faz 4 decision: current rank is still Persistent.
    const r = currentRankFromUnlocks(
      new Set(['traveler', 'first_step', 'steady', 'persistent'])
    );
    expect(r.id).toBe('persistent');
  });
});

describe('nextRankAfter', () => {
  it('null when already at Free (ceiling)', () => {
    const free = RANK_LADDER[RANK_LADDER.length - 1];
    expect(nextRankAfter(free)).toBeNull();
  });

  it('advances one rank up the ladder', () => {
    const traveler = RANK_LADDER[0];
    expect(nextRankAfter(traveler)?.id).toBe('first_step');
  });
});

describe('progressWithinRank', () => {
  it('exactly at current threshold = 0', () => {
    const first = RANK_LADDER[1]; // First Step (100)
    expect(progressWithinRank({ score: 100, current: first })).toBe(0);
  });

  it('halfway to next rank = 0.5', () => {
    // First Step (100) → Steady (400) — span 300, halfway = 250.
    const first = RANK_LADDER[1];
    expect(progressWithinRank({ score: 250, current: first })).toBeCloseTo(
      0.5,
      2
    );
  });

  it('past next threshold clamps to 1', () => {
    // Score 5000 while "current" says First Step (100) — happens
    // between resolve write and cache refresh. Progress capped.
    const first = RANK_LADDER[1];
    expect(progressWithinRank({ score: 5000, current: first })).toBe(1);
  });

  it('ceiling rank always reports 1', () => {
    const free = RANK_LADDER[RANK_LADDER.length - 1];
    expect(progressWithinRank({ score: 0, current: free })).toBe(1);
    expect(progressWithinRank({ score: 999999, current: free })).toBe(1);
  });
});
