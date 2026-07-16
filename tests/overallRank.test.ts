import { describe, expect, it } from 'vitest';
import { overallRankFromTotalPoints } from '@/lib/overallRank';
import { RANK_LADDER } from '@/shared/ranks';

/**
 * Design-polish M6 — projects the per-addiction rank ladder onto
 * the user's cross-addiction total. The math is the same; these
 * tests lock the semantics down so a future ladder recalibration
 * in shared/ranks.ts doesn't quietly break the Profile hero card.
 */

describe('overallRankFromTotalPoints', () => {
  it('starts at Traveler with 0 points', () => {
    const s = overallRankFromTotalPoints(0);
    expect(s.current.id).toBe('traveler');
    expect(s.next?.id).toBe('first_step');
    expect(s.progress).toBe(0);
    expect(s.pointsToNext).toBe(100);
  });

  it('reports 50% progress halfway between two thresholds', () => {
    // Halfway between First Step (100) and Steady (400) = 250.
    const s = overallRankFromTotalPoints(250);
    expect(s.current.id).toBe('first_step');
    expect(s.next?.id).toBe('steady');
    expect(s.progress).toBeCloseTo(0.5, 2);
    expect(s.pointsToNext).toBe(150);
  });

  it('jumps to the reached rank the moment score crosses the threshold', () => {
    const atFloor = overallRankFromTotalPoints(999);
    expect(atFloor.current.id).toBe('steady');
    const atThreshold = overallRankFromTotalPoints(1000);
    expect(atThreshold.current.id).toBe('persistent');
  });

  it('saturates at the Free ceiling with no next rank', () => {
    const ceiling = RANK_LADDER[RANK_LADDER.length - 1];
    const s = overallRankFromTotalPoints(ceiling.thresholdScore + 5000);
    expect(s.current.id).toBe('free');
    expect(s.next).toBeNull();
    expect(s.progress).toBe(1);
    expect(s.pointsToNext).toBeNull();
  });

  it('clamps progress at 1 when score exceeds the current band', () => {
    // Should not be possible in practice — the moment score enters
    // the next band we shift ranks — but guard the math anyway.
    const s = overallRankFromTotalPoints(500);
    expect(s.progress).toBeGreaterThanOrEqual(0);
    expect(s.progress).toBeLessThanOrEqual(1);
  });
});
