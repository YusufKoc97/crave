import { describe, expect, it } from 'vitest';
import {
  calculateResistPoints,
  daysBetween,
  localDayKey,
  nextStreak,
  weeklyResistCounts,
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

  // Edge cases for boundary scenarios that almost-but-don't-quite
  // round-trip through daysBetween.
  it('extends across year boundaries (Dec 31 → Jan 1)', () => {
    expect(
      nextStreak({
        lastResistDay: '2025-12-31',
        today: '2026-01-01',
        currentStreak: 30,
      })
    ).toBe(31);
  });

  it('extends across month boundaries (Feb 28 → Mar 1 in a non-leap year)', () => {
    expect(
      nextStreak({
        lastResistDay: '2025-02-28',
        today: '2025-03-01',
        currentStreak: 4,
      })
    ).toBe(5);
  });

  it('extends across leap-year Feb 29 → Mar 1', () => {
    expect(
      nextStreak({
        lastResistDay: '2024-02-29',
        today: '2024-03-01',
        currentStreak: 12,
      })
    ).toBe(13);
  });

  it('starts at 1 even with a huge currentStreak when last resist is ancient', () => {
    // A user reopens the app after a long break. Their stored streak
    // is stale; the local cache anchored to last year is the gap proof.
    expect(
      nextStreak({
        lastResistDay: '2025-01-15',
        today: '2026-03-05',
        currentStreak: 99,
      })
    ).toBe(1);
  });

  it('does not extend across a 2-day gap (Mar 3 → Mar 5)', () => {
    expect(
      nextStreak({
        lastResistDay: '2026-03-03',
        today: '2026-03-05',
        currentStreak: 5,
      })
    ).toBe(1);
  });
});

describe('weeklyResistCounts', () => {
  const NOW = new Date('2026-03-05T14:00:00').getTime();
  const DAY = 86400000;

  it('returns 7 zeros for an empty session list', () => {
    expect(weeklyResistCounts({ sessions: [], nowMs: NOW })).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('puts today in slot 6 and six-days-ago in slot 0', () => {
    const counts = weeklyResistCounts({
      sessions: [
        { outcome: 'resisted', createdAt: NOW - 6 * DAY },
        { outcome: 'resisted', createdAt: NOW },
      ],
      nowMs: NOW,
    });
    expect(counts[0]).toBe(1);
    expect(counts[6]).toBe(1);
    expect(counts.slice(1, 6)).toEqual([0, 0, 0, 0, 0]);
  });

  it('counts multiple resists on the same day', () => {
    const counts = weeklyResistCounts({
      sessions: [
        { outcome: 'resisted', createdAt: NOW - 3600000 }, // earlier today
        { outcome: 'resisted', createdAt: NOW - 7200000 }, // earlier today
        { outcome: 'resisted', createdAt: NOW - 10800000 }, // earlier today
      ],
      nowMs: NOW,
    });
    expect(counts[6]).toBe(3);
  });

  it('ignores gave_in sessions', () => {
    const counts = weeklyResistCounts({
      sessions: [
        { outcome: 'gave_in', createdAt: NOW },
        { outcome: 'gave_in', createdAt: NOW - DAY },
      ],
      nowMs: NOW,
    });
    expect(counts.every((c) => c === 0)).toBe(true);
  });

  it('drops sessions older than 7 days', () => {
    const counts = weeklyResistCounts({
      sessions: [
        { outcome: 'resisted', createdAt: NOW - 30 * DAY },
        { outcome: 'resisted', createdAt: NOW - 7 * DAY }, // exactly 7 days ago = boundary, out
        { outcome: 'resisted', createdAt: NOW - 6 * DAY }, // 6 days ago = in
      ],
      nowMs: NOW,
    });
    expect(counts[0]).toBe(1);
    expect(counts.reduce((a, b) => a + b)).toBe(1);
  });

  it('drops sessions in the future (delta < 0)', () => {
    const counts = weeklyResistCounts({
      sessions: [{ outcome: 'resisted', createdAt: NOW + DAY }],
      nowMs: NOW,
    });
    expect(counts.every((c) => c === 0)).toBe(true);
  });
});
