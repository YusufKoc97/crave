/**
 * Profile module theme — mirrors the module-owned theme pattern used
 * by Comparison (`comparisonTheme.ts`). Lives alongside the global
 * design system: the Profile screen still consumes `dsColors`,
 * `dsFont`, `dsRadius`, `dsSpacing` for every surface, radius, and
 * type token. The only thing this file adds is the *rank / achievement
 * gold* accent used exclusively inside the hero rank card — a colour
 * the base palette doesn't carry because no other screen has an
 * achievement moment. Everything else on Profile stays blue-accented
 * (`dsColors.accentBlue`) or addiction-coloured.
 */

import { hexAlpha } from '@/constants/designSystem';

/** Rank / achievement gold. Warm, readable on the deep-navy base. */
export const profileGold = '#F4C651';
/** Dimmed gold for the low end of the streak-flame gradient. */
export const profileGoldDim = '#6E5A2C';

export { hexAlpha };

/** Animation timings — kept in one object so the hero draw-on, the
 *  count-ups, and the particle drift read as one choreographed entry. */
export const PROFILE_ANIM = {
  /** Ring arc draw-on, 0 → progress. Brief: 900ms, ease-out. */
  ringDrawMs: 900,
  /** Count-up roll for every stat number (matches module-tab feel). */
  countUpMs: 1000,
  /** Per-stat stagger so the grid rolls up in sequence. */
  countUpStaggerMs: 90,
  /** Progress bar fill under the hero points. */
  barFillMs: 900,
  /** One full particle drift cycle inside the hero card. */
  particleDriftMs: 9000,
} as const;

/**
 * Build an SVG polyline `d` for a sparkline from a series of values.
 * Normalises to [0..1] across the series' own min/max so a flat line
 * (all-equal) sits mid-height instead of collapsing to the floor.
 * Pure — no React, safe to call at render time.
 */
export function sparklinePath(
  values: readonly number[],
  width: number,
  height: number,
  pad = 1
): string {
  if (values.length === 0) return '';
  if (values.length === 1) {
    const midY = height / 2;
    return `M0,${midY.toFixed(1)} L${width},${midY.toFixed(1)}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerH = height - pad * 2;
  const stepX = width / (values.length - 1);
  let d = '';
  values.forEach((v, i) => {
    const x = i * stepX;
    // Higher value → higher on screen (smaller y). Flat series → mid.
    const norm = span === 0 ? 0.5 : (v - min) / span;
    const y = pad + (1 - norm) * innerH;
    d += (i === 0 ? 'M' : ' L') + x.toFixed(1) + ',' + y.toFixed(1);
  });
  return d;
}
