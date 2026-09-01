import { describe, expect, it } from 'vitest';
import { computeStreakMap, type StreakSessionRow } from '@/lib/streakMapCore';

/**
 * Local-time ISO string (no trailing Z) so Date.parse reads it in the
 * machine's zone — the same zone `computeStreakMap` groups and steps
 * in. Keeps the fold TZ-independent for CI. `m` is 1-based.
 */
function at(y: number, m: number, d: number, hour = 12): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}T${p(hour)}:00:00`;
}
const NOW = Date.parse(at(2026, 8, 23));

function row(outcome: string, dateStr: string): StreakSessionRow {
  return { outcome, created_at: dateStr };
}

describe('computeStreakMap', () => {
  it('returns a fully-zeroed map for no history', () => {
    const m = computeStreakMap([], NOW);
    expect(m.recordCount).toBe(0);
    expect(m.days).toHaveLength(0);
    expect(m.currentStreak).toBe(0);
    expect(m.bestStreak).toBe(0);
    expect(m.bestRange).toBeNull();
    expect(m.currentRange).toBeNull();
  });

  it('maps a single resisted day today to one lit cell', () => {
    const m = computeStreakMap([row('resisted', at(2026, 8, 23))], NOW);
    expect(m.recordCount).toBe(1);
    expect(m.days).toHaveLength(1);
    expect(m.days[0].level).toBe(1);
    expect(m.days[0].giveIn).toBe(false);
    expect(m.currentStreak).toBe(1);
    expect(m.bestStreak).toBe(1);
  });

  it('clamps density at level 4 for 4+ resists in a day', () => {
    const rows = Array.from({ length: 6 }, () =>
      row('resisted', at(2026, 8, 23))
    );
    const m = computeStreakMap(rows, NOW);
    expect(m.days[0].level).toBe(4);
    expect(m.recordCount).toBe(6);
  });

  it('bridges craving-free days: an empty day does not break the streak', () => {
    // resisted on the 20th, nothing on 21st/22nd, resisted on the 23rd.
    const m = computeStreakMap(
      [row('resisted', at(2026, 8, 20)), row('resisted', at(2026, 8, 23))],
      NOW
    );
    expect(m.days).toHaveLength(4); // 20,21,22,23 gap-filled
    expect(m.days[1].level).toBe(0); // 21st empty
    expect(m.days[1].giveIn).toBe(false);
    expect(m.currentStreak).toBe(4); // whole span is give-in-free
    expect(m.bestStreak).toBe(4);
  });

  it('breaks the streak only on a give-in, and marks that cell', () => {
    // 16-19 resisted, 20 give-in, 21 & 23 resisted (22 empty).
    const rows = [
      row('resisted', at(2026, 8, 16)),
      row('resisted', at(2026, 8, 17)),
      row('resisted', at(2026, 8, 18)),
      row('resisted', at(2026, 8, 19)),
      row('failed', at(2026, 8, 20)),
      row('resisted', at(2026, 8, 21)),
      row('resisted', at(2026, 8, 23)),
    ];
    const m = computeStreakMap(rows, NOW);
    expect(m.days).toHaveLength(8); // 16..23
    // give-in cell overrides density and reads as a slash.
    expect(m.days[4].giveIn).toBe(true);
    expect(m.days[4].level).toBe(0);
    // best run = 16-19 (len 4); current = 21,22(empty),23 (len 3).
    expect(m.bestStreak).toBe(4);
    expect(m.bestRange).toEqual({ start: 0, end: 3 });
    expect(m.currentStreak).toBe(3);
    expect(m.currentRange).toEqual({ start: 5, end: 7 });
  });

  it('marks give-in on a day that also had a resist', () => {
    const m = computeStreakMap(
      [row('resisted', at(2026, 8, 23)), row('failed', at(2026, 8, 23))],
      NOW
    );
    expect(m.days).toHaveLength(1);
    expect(m.days[0].giveIn).toBe(true);
    expect(m.days[0].level).toBe(0);
    expect(m.currentStreak).toBe(0);
    expect(m.currentRange).toBeNull();
  });

  it('yields no current streak when today is a give-in', () => {
    const m = computeStreakMap(
      [row('resisted', at(2026, 8, 21)), row('failed', at(2026, 8, 23))],
      NOW
    );
    expect(m.currentStreak).toBe(0);
    // best run was the 21st (22nd empty bridges nothing after the slip).
    expect(m.bestStreak).toBe(2); // 21 resisted, 22 empty give-in-free
    expect(m.bestRange).toEqual({ start: 0, end: 1 });
  });
});
