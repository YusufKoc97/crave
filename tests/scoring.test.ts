import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  calculateResistPoints,
  daysBetween,
  failurePenalty,
  FAILURE_PENALTY_MAX,
  localDayKey,
  nextMomentum,
  nextStreak,
  weeklyResistCounts,
} from '@/lib/scoring';

/**
 * Scoring is the Faz 3 shared/scoring.ts contract. These tests double
 * as the specification the resolve-craving Edge Function has to match
 * — if either side drifts, gate here fails first.
 */

describe('calculateResistPoints', () => {
  it('returns 0 for failed outcome', () => {
    expect(
      calculateResistPoints({
        outcome: 'failed',
        durationSeconds: 600,
        sensitivity: 5,
      })
    ).toBe(0);
  });

  it('brief example — nicotine (sens 8), 20 min → 160 pts', () => {
    // base = 20*8 = 160, cycleLength = 40 min, cycles = floor(20/40) = 0
    expect(
      calculateResistPoints({
        outcome: 'resisted',
        durationSeconds: 20 * 60,
        sensitivity: 8,
      })
    ).toBe(160);
  });

  it('brief example — nicotine (sens 8), 45 min → 400 pts', () => {
    // base = 45*8 = 360, cycleLength = 40 min, cycles = floor(45/40) = 1
    // bonus = 1 * 40 = 40, total = 400
    expect(
      calculateResistPoints({
        outcome: 'resisted',
        durationSeconds: 45 * 60,
        sensitivity: 8,
      })
    ).toBe(400);
  });

  it('very short resist rounds to 0 (no floor)', () => {
    // 5 s at sens 1 = 0.083 min * 1 = 0.083 → round to 0.
    // No floor in the Faz 3 formula; the Edge Function still records
    // the resolve, just with 0 delta.
    expect(
      calculateResistPoints({
        outcome: 'resisted',
        durationSeconds: 5,
        sensitivity: 1,
      })
    ).toBe(0);
  });

  it('exactly one cycle: base + bonus', () => {
    // sens 6 → cycle length 30 min. 30 min * 6 = 180 base
    // cycles = floor(30/30) = 1, bonus = 30.
    expect(
      calculateResistPoints({
        outcome: 'resisted',
        durationSeconds: 30 * 60,
        sensitivity: 6,
      })
    ).toBe(210);
  });
});

describe('failurePenalty', () => {
  it('brief example — score 500 → penalty 25 (5%)', () => {
    expect(failurePenalty(500)).toBe(25);
  });

  it('brief example — score 100 → penalty 5 (5%)', () => {
    expect(failurePenalty(100)).toBe(5);
  });

  it('brief example — score 10000 → penalty capped at 200', () => {
    expect(failurePenalty(10000)).toBe(FAILURE_PENALTY_MAX);
    expect(failurePenalty(10000)).toBe(200);
  });

  it('score 0 → penalty 0', () => {
    expect(failurePenalty(0)).toBe(0);
  });

  it('score 1 → penalty 0 (round(0.05) = 0)', () => {
    expect(failurePenalty(1)).toBe(0);
  });
});

describe('applyOutcome', () => {
  it('resisted — brief example newScore + delta', () => {
    const r = applyOutcome({
      currentScore: 500,
      outcome: 'resisted',
      durationSeconds: 20 * 60,
      sensitivity: 8,
    });
    expect(r).toEqual({ newScore: 660, delta: 160 });
  });

  it('failed — clamps at 0', () => {
    const r = applyOutcome({
      currentScore: 3,
      outcome: 'failed',
      durationSeconds: 60,
      sensitivity: 5,
    });
    // penalty = round(3*0.05) = 0 → newScore=3, delta=0.
    expect(r).toEqual({ newScore: 3, delta: 0 });
  });

  it('failed — 500 → 475 (delta -25)', () => {
    const r = applyOutcome({
      currentScore: 500,
      outcome: 'failed',
      durationSeconds: 60,
      sensitivity: 5,
    });
    expect(r).toEqual({ newScore: 475, delta: -25 });
  });

  it('failed — huge score respects 200 cap', () => {
    const r = applyOutcome({
      currentScore: 10000,
      outcome: 'failed',
      durationSeconds: 60,
      sensitivity: 5,
    });
    expect(r).toEqual({ newScore: 9800, delta: -200 });
  });
});

describe('nextMomentum', () => {
  it('caps at 100 no matter how big the gain', () => {
    expect(
      nextMomentum({
        currentMomentum: 95,
        durationSeconds: 60 * 60,
        sensitivity: 10,
      })
    ).toBe(100);
  });

  it('minimum gain is 1', () => {
    expect(
      nextMomentum({
        currentMomentum: 50,
        durationSeconds: 0,
        sensitivity: 0,
      })
    ).toBe(51);
  });

  it('scales with sensitivity and duration', () => {
    // sens 5, 10 min → round(5*1.5 + 10*0.4) = round(7.5 + 4) = 12
    expect(
      nextMomentum({
        currentMomentum: 50,
        durationSeconds: 10 * 60,
        sensitivity: 5,
      })
    ).toBe(62);
  });
});

describe('nextStreak', () => {
  it('same day: no bump', () => {
    expect(
      nextStreak({
        lastResistDay: '2026-01-01',
        today: '2026-01-01',
        currentStreak: 5,
      })
    ).toBe(5);
  });

  it('exactly one day later: +1', () => {
    expect(
      nextStreak({
        lastResistDay: '2026-01-01',
        today: '2026-01-02',
        currentStreak: 5,
      })
    ).toBe(6);
  });

  it('gap of 2+: reset to 1', () => {
    expect(
      nextStreak({
        lastResistDay: '2026-01-01',
        today: '2026-01-05',
        currentStreak: 10,
      })
    ).toBe(1);
  });

  it('no previous resist: start at 1', () => {
    expect(
      nextStreak({
        lastResistDay: null,
        today: '2026-01-01',
        currentStreak: 0,
      })
    ).toBe(1);
  });
});

describe('localDayKey / daysBetween', () => {
  it('formats as YYYY-MM-DD', () => {
    const ts = new Date(2026, 0, 5, 15, 30).getTime();
    expect(localDayKey(ts)).toBe('2026-01-05');
  });

  it('daysBetween handles same day', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('daysBetween handles forward', () => {
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
  });

  it('daysBetween handles reverse', () => {
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(-7);
  });
});

describe('weeklyResistCounts', () => {
  const nowMs = new Date(2026, 0, 8, 12, 0).getTime(); // Thu 2026-01-08

  it('empty sessions → all zeros', () => {
    expect(weeklyResistCounts({ sessions: [], nowMs })).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('only resisted outcomes are counted', () => {
    const sessions = [
      { outcome: 'resisted' as const, createdAt: nowMs },
      { outcome: 'failed' as const, createdAt: nowMs },
      { outcome: 'failed' as const, createdAt: nowMs },
    ];
    const counts = weeklyResistCounts({ sessions, nowMs });
    expect(counts[6]).toBe(1);
  });

  it('index 0 = 6 days ago, index 6 = today', () => {
    const sixDaysAgo = new Date(2026, 0, 2, 8, 0).getTime();
    const sessions = [
      { outcome: 'resisted' as const, createdAt: sixDaysAgo },
      { outcome: 'resisted' as const, createdAt: sixDaysAgo },
      { outcome: 'resisted' as const, createdAt: nowMs },
    ];
    const counts = weeklyResistCounts({ sessions, nowMs });
    expect(counts[0]).toBe(2);
    expect(counts[6]).toBe(1);
  });

  it('sessions outside the 7-day window are silently dropped', () => {
    const eightDaysAgo = new Date(2026, 0, 1).getTime();
    const sessions = [
      { outcome: 'resisted' as const, createdAt: eightDaysAgo },
    ];
    expect(weeklyResistCounts({ sessions, nowMs })).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});
