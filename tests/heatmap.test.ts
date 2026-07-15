import { describe, expect, it } from 'vitest';
import {
  DAY_KEYS,
  DAYS_IN_WEEK,
  DEFAULT_PERIOD,
  HEATMAP_COLORS,
  HOURS_IN_DAY,
  PERIOD_ORDER,
  TRIGGER_MAP_STALE_MS,
  heatmapColor,
} from '@/constants/heatmap';

/**
 * Faz 8a — constants + colour bucket invariants for Modül 3.
 * Insights don't exist yet (Faz 8b), so this suite covers the
 * heatmap grid + period filter surfaces only.
 */

describe('heatmap constants', () => {
  it('grid is 7 columns × 24 rows', () => {
    expect(DAYS_IN_WEEK).toBe(7);
    expect(HOURS_IN_DAY).toBe(24);
  });

  it('DAY_KEYS carries the canonical Mon…Sun order', () => {
    expect([...DAY_KEYS]).toEqual([
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
      'sun',
    ]);
  });

  it('period order matches the picker', () => {
    expect([...PERIOD_ORDER]).toEqual(['7d', '30d', 'all']);
  });

  it('default period is 30d', () => {
    expect(DEFAULT_PERIOD).toBe('30d');
  });

  it('stale time is exactly 5 minutes', () => {
    expect(TRIGGER_MAP_STALE_MS).toBe(5 * 60_000);
  });
});

describe('heatmapColor buckets', () => {
  it('empty cell = ramp[0]', () => {
    expect(heatmapColor(0)).toBe(HEATMAP_COLORS[0]);
    expect(heatmapColor(-1)).toBe(HEATMAP_COLORS[0]);
  });

  it('count 1 = ramp[1]', () => {
    expect(heatmapColor(1)).toBe(HEATMAP_COLORS[1]);
  });

  it('count 2 = ramp[2]', () => {
    expect(heatmapColor(2)).toBe(HEATMAP_COLORS[2]);
  });

  it('counts 3-4 = ramp[3]', () => {
    expect(heatmapColor(3)).toBe(HEATMAP_COLORS[3]);
    expect(heatmapColor(4)).toBe(HEATMAP_COLORS[3]);
  });

  it('count 5+ = ramp[4] (hottest)', () => {
    expect(heatmapColor(5)).toBe(HEATMAP_COLORS[4]);
    expect(heatmapColor(50)).toBe(HEATMAP_COLORS[4]);
    expect(heatmapColor(999)).toBe(HEATMAP_COLORS[4]);
  });

  it('ramp is 5 colours (empty + 4 populated buckets)', () => {
    expect(HEATMAP_COLORS.length).toBe(5);
  });

  it('ramp is monotonically distinct (no adjacent dupes)', () => {
    for (let i = 1; i < HEATMAP_COLORS.length; i++) {
      expect(HEATMAP_COLORS[i]).not.toBe(HEATMAP_COLORS[i - 1]);
    }
  });
});
