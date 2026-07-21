/**
 * Triggers-module theme (Modül 3 redesign).
 *
 * Design brief (design_handoff_triggers): Triggers is its own visual
 * family within the Info screen. It borrows the Journey/Toolkit
 * dark-glass language but has a dedicated accent — **violet #8f7bf0** —
 * so a glance at the sub-tab tells you which module you're in.
 *
 * `addiction.color` no longer drives anything inside this pane; the
 * Triggers-module IS violet regardless of which addiction is being
 * viewed. Cross-cutting elements (insights icons, chart tints, hero
 * radial ring, gate CTA) all pull from `triggersAccent`.
 *
 * Category colours belong here too. They're used by the Personal
 * Insights cards (left color stripe, icon square tint, trend badge)
 * and by the Trigger Distribution intensity dots — the same trigger
 * ID ("stress") should carry the same colour on both surfaces.
 */

/** Violet accent that owns the Triggers sub-tab. */
export const triggersAccent = '#8f7bf0';

/** Category → accent colour. Drives insight cards + distribution dots. */
export const triggersCategoryColors = {
  // insight rule categories (shared/insightRules → InsightCategory)
  time: '#8f7bf0', // violet — matches the module accent
  trigger: '#e0607a', // stress-tinged coral
  technique: '#5bb6d9', // technique / social cyan
  trend: '#7dc98a', // boredom / progress green

  // trigger-id → colour (Distribution + tags on peak cards)
  stress: '#e0607a',
  loneliness: '#e0aa60',
  tired: '#e0aa60',
  tiredness: '#e0aa60',
  boredom: '#7dc98a',
  social: '#5bb6d9',
  social_situation: '#5bb6d9',
  anxiety: '#e0607a',
  sadness: '#e0aa60',
  anger: '#e0607a',
} as const;

/**
 * Resolve a trigger-id (or category) to its brand colour, falling
 * back to the module accent when the id isn't in the palette map.
 */
export function triggersColorFor(key: string): string {
  const map = triggersCategoryColors as Record<string, string | undefined>;
  return map[key] ?? triggersAccent;
}

/**
 * Shared glass-surface tokens for the Triggers cards. Values chosen
 * to sit inside the AmbientGlow-lit detail screen without competing
 * with the addiction's own accent glow above.
 */
export const triggersSurface = {
  bg: '#0F1A32', // slightly warmer than dsColors.bgBase for glass "lift"
  bgElevated: '#141F3A',
  border: 'rgba(143, 123, 240, 0.18)', // violet tint on border
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  radius: 18,
} as const;

/**
 * Heatmap violet ramp (design brief).
 *   0     → very dim white surface
 *   1–2   → accent @ .28
 *   3–4   → accent @ .55
 *   5+    → accent full (glow drawn separately)
 */
export const triggersHeatmapRamp = [
  'rgba(255,255,255,0.05)',
  triggersAccentAlpha(0.28),
  triggersAccentAlpha(0.55),
  triggersAccent, // full, glow layered by cell
] as const;

/** Bucket a count into the ramp index (0..3). */
export function triggersHeatmapBucket(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

/** Resolve the fill for a heatmap cell given a raw craving count. */
export function triggersHeatmapFill(count: number): string {
  return triggersHeatmapRamp[triggersHeatmapBucket(count)];
}

/** hex → rgba(). Local copy so this module has no external dep. */
export function triggersHexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Convenience shortcut — Triggers accent at a given alpha. */
export function triggersAccentAlpha(alpha: number): string {
  return triggersHexAlpha(triggersAccent, alpha);
}
