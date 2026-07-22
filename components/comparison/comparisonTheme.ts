/**
 * Comparison-module theme (Modül 4).
 *
 * Design brief (`design_handoff_comparison`): Comparison is the
 * "gözlemevi" — the observatory. Same dark-glass surface language
 * as Journey/Toolkit/Triggers, but the accent stays anchored to
 * the parent detail screen's `addiction.color` (Triggers is the
 * exception — it owns violet across every addiction; Comparison
 * follows the addiction).
 *
 * Two additional palette anchors live here so the pane can
 * distinguish itself from the accent:
 *   - **Community neutral** `#6a7fa0` — the grey-blue used for
 *     avg lines, community comparators, "not you" surfaces.
 *   - **Success green** `#7dc98a` — RESERVED. Only shows on
 *     positive-tone signals: resistance-rate delta, hold-out
 *     delta, Urge Surfing effectiveness card, rising trend.
 *     NEVER on craving counts (fewer/more is neutral — brief).
 *   - **Stress amber** `#e6a35c` — dedicated pulse-card
 *     highlight for the "Stress 41%" trigger callout.
 */

export const compColors = {
  community: '#6a7fa0',
  success: '#7dc98a',
  stress: '#e6a35c',
  textPrimary: '#f4f7fc',
  textSecondary: '#a7b2ca',
  textMuted: '#7f8db0',
  textDim: '#6a7899',
  kicker: '#8a97b4',
} as const;

/**
 * Shared glass-surface tokens for Comparison cards. Slightly
 * warmer + more opaque than Triggers because Comparison sits
 * inside the same detail screen's dual AmbientGlow (blue anchor
 * + addiction color) and needs to hold text readability without
 * competing.
 */
export const compSurface = {
  bg: '#131F3A',
  bgElevated: '#1A2748',
  radius: 20,
  radiusLg: 22,
  radiusXl: 24,
} as const;

/**
 * Single CONST object for durations + stagger + distribution
 * sd defaults — per handoff instruction:
 * "Zamanlama/renk sabitlerini tek bir CONST objesine al".
 */
export const COMP = {
  // Card mount stagger (ms between cards in a group).
  cardStaggerMs: 80,
  // Card mount tween duration.
  cardEnterMs: 500,
  // Count-up duration.
  countUpMs: 800,
  // Count-up stagger between numbers in the same card (Pulse trio).
  countUpStaggerMs: 150,
  // Ticker (Pulse card) — how long each event holds before crossfade.
  tickerCycleMs: 12000,
  // Ticker slot duration (visible + fade time within a single item).
  tickerVisibleMs: 4000,
  // Live-now pulse ring period.
  livePulseMs: 2000,
  // ECG stroke-draw loop period.
  ecgDrawMs: 4000,
  // Ambient breathing loop for pulse-card background gradient.
  breatheMs: 6000,
  // Bell curve draw duration.
  bellDrawMs: 600,
  // User dot pop-in duration.
  dotPopMs: 700,
  // User dot ambient pulse ring loop.
  dotPulseMs: 2600,
  // Radial clock arc sweep.
  clockSweepMs: 800,
  // Wave drift periods (2 layers).
  waveMsFast: 6000,
  waveMsSlow: 9000,
  // Bar chart rise.
  barRiseMs: 600,
  // Tuesday bar continuous glow loop.
  barGlowMs: 3200,
  // Delta chip appearance (fade in after mount).
  deltaChipDelayMs: 1000,

  // Distribution card standard deviations (normal-distribution
  // assumption for percentile calculation). Brief-mandated
  // defaults so all callers agree on "how spread out is this
  // metric across the community".
  sdResistanceRate: 15,
  sdHoldOutMin: 5,
  sdCravingsPerWeek: 6,
} as const;

/** hex → rgba(). Local copy so this module has no external dep. */
export function compHexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
