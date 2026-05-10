import { describe, expect, it } from 'vitest';
import {
  calculateResistPoints,
  daysBetween,
  localDayKey,
  nextStreak,
} from '@/lib/scoring';

describe('calculateResistPoints', () => {
  it('returns 0 for gave_in regardless of cycles', () => {
    expect(
      calculateResistPoints({
        outcome: 'gave_in',
        durationSeconds: 600,
        sensitivity: 5,
        completedCycles: 2,
      })
    ).toBe(0);
  });

  it('floors short resists at 1 point', () => {
    expect(
      calculateResistPoints({
        outcome: 'resisted',
        durationSeconds: 5,
        sensitivity: 1,
        completedCycles: 0,
      })
    ).toBe(1);
  });

  it('credits a cycle bonus per full cycle (not per session)', () => {
    // 30 min × 10 sens = 300 base + 10*5*3 = 150 bonus → 450
    expect(
      calculateResistPoints({
        outcome: 'resisted',
        durationSeconds: 1800,
        sensitivity: 10,
        completedCycles: 3,
      })
    ).toBe(450);
  });

  it('treats 0 cycles as no bonus', () => {
    // 5 min × 6 sens = 30, bonus 0
    expect(
      calculateResistPoints({
        outcome: 'resisted',
        durationSeconds: 300,
        sensitivity: 6,
        completedCycles: 0,
      })
    ).toBe(30);
  });
});

describe('localDayKey', () => {
  it('produces a YYYY-MM-DD string in the host timezone', () => {
    const key = localDayKey(new Date('2026-03-05T14:30:00').getTime());
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(key).toBe('2026-03-05');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDayKey(new Date('2026-01-05T00:00:00').getTime())).toBe(
      '2026-01-05'
    );
  });
});

describe('daysBetween', () => {
  it('returns 1 for adjacent calendar days', () => {
    expect(daysBetween('2026-03-04', '2026-03-05')).toBe(1);
  });

  it('returns 0 for the same day', () => {
    expect(daysBetween('2026-03-05', '2026-03-05')).toBe(0);
  });

  it('handles month boundaries', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('handles DST transition without false-tripping (rounded)', () => {
    // Spring forward in many regions falls on March 9, 2025 — the
    // delta is 23h, not 24h. Math.round() floors that to 1 day.
    expect(daysBetween('2025-03-08', '2025-03-09')).toBe(1);
  });

  it('returns negative when from > to', () => {
    expect(daysBetween('2026-03-10', '2026-03-05')).toBe(-5);
  });
});

describe('nextStreak', () => {
  it('starts a fresh streak at 1 when nothing precedes', () => {
    expect(
      nextStreak({ lastResistDay: null, today: '2026-03-05', currentStreak: 0 })
    ).toBe(1);
  });

  it('extends yesterday-anchored chains by 1', () => {
    expect(
      nextStreak({
        lastResistDay: '2026-03-04',
        today: '2026-03-05',
        currentStreak: 7,
      })
    ).toBe(8);
  });

  it('does not double-count multiple resists in the same day', () => {
    expect(
      nextStreak({
        lastResistDay: '2026-03-05',
        today: '2026-03-05',
        currentStreak: 7,
      })
    ).toBe(7);
  });

  it('resets to 1 when a gap > 1 day breaks the chain', () => {
    expect(
      nextStreak({
        lastResistDay: '2026-03-01',
        today: '2026-03-05',
        currentStreak: 10,
      })
    ).toBe(1);
  });
});
