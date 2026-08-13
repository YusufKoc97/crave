import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  calculateResistPoints,
  daysBetween,
  failurePenalty,
  FAILURE_PENALTY_MAX,
  localDayKey,
  MAX_DAILY_POINTS_PER_ADDICTION,
  MAX_SCORED_MINUTES,
  MAX_SESSION_MINUTES,
  nextMomentum,
  streakAfterGiveIn,
  streakAfterResist,
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

describe('streakAfterResist', () => {
  it('each resist extends the run by 1 (event-based, not day-based)', () => {
    expect(streakAfterResist(0)).toBe(1);
    expect(streakAfterResist(14)).toBe(15);
  });
});

describe('streakAfterGiveIn', () => {
  it('free user resets fully to 0', () => {
    expect(streakAfterGiveIn(15, false)).toBe(0);
    expect(streakAfterGiveIn(1, false)).toBe(0);
  });

  it('premium user keeps half, rounded down (Streak Protection)', () => {
    expect(streakAfterGiveIn(15, true)).toBe(7);
    expect(streakAfterGiveIn(10, true)).toBe(5);
  });

  it('premium edge: streak 1 halves to 0, same as a reset — no special-casing', () => {
    expect(streakAfterGiveIn(1, true)).toBe(0);
  });

  it('streak 0 stays 0 for both tiers', () => {
    expect(streakAfterGiveIn(0, false)).toBe(0);
    expect(streakAfterGiveIn(0, true)).toBe(0);
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

/**
 * Abuse ceilings (2026-07-31 rate-limit audit).
 *
 * Before these, a single resolve at the accepted maximum (1440 min,
 * sensitivity 10) awarded 15,800 points against a top rank of 75,000 —
 * five calls cleared the whole ladder. The clamp is the load-bearing
 * fix; the hourly rate limit alone does not bound score.
 */
describe('award ceiling', () => {
  it('clamps the scored duration at MAX_SCORED_MINUTES', () => {
    const atCap = calculateResistPoints({
      outcome: 'resisted',
      durationSeconds: MAX_SCORED_MINUTES * 60,
      sensitivity: 10,
    });
    const wayOver = calculateResistPoints({
      outcome: 'resisted',
      durationSeconds: MAX_SESSION_MINUTES * 60, // 24h, the hard reject
      sensitivity: 10,
    });
    expect(wayOver).toBe(atCap);
  });

  it('caps a single award well below the top rank', () => {
    const worstCase = calculateResistPoints({
      outcome: 'resisted',
      durationSeconds: MAX_SESSION_MINUTES * 60,
      sensitivity: 10,
    });
    // Top rank is 75_000. One call must not be able to make a dent
    // measured in whole ranks.
    expect(worstCase).toBeLessThanOrEqual(3000);
  });

  it('leaves ordinary sessions completely untouched', () => {
    // A realistic craving: 12 minutes at sensitivity 5, nowhere near
    // the clamp. base = 12*5 = 60; cycleLength = 25 min so no cycle
    // bonus. Regression guard — the ceiling must never change the
    // number an honest user sees.
    expect(
      calculateResistPoints({
        outcome: 'resisted',
        durationSeconds: 12 * 60,
        sensitivity: 5,
      })
    ).toBe(60);
  });

  it('keeps the daily cap above realistic heavy use', () => {
    const heavyDay =
      10 *
      calculateResistPoints({
        outcome: 'resisted',
        durationSeconds: 12 * 60,
        sensitivity: 5,
      });
    expect(heavyDay).toBeLessThan(MAX_DAILY_POINTS_PER_ADDICTION);
  });
});
