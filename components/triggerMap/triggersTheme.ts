/**
 * Triggers-module theme (Modül 3 redesign).
 *
 * Design brief (design_handoff_triggers): Triggers is its own visual
 * family within the Info screen. It borrows the Journey/Toolkit
 * dark-glass language, but — as of the 2026-07-26 accent pass — it
 * follows **the open addiction's colour**, exactly like Comparison
 * (Modül 4) already does. The pane used to hard-code violet
 * `#8f7bf0`, which made Smoking's gold detail screen flip to violet
 * the moment you tapped the Triggers sub-tab.
 *
 * The accent reaches components through `TriggersAccentProvider` /
 * `useTriggersAccent()` (see `triggersAccent.tsx`) because the tree is
 * deep (Pane → InsightSection → InsightsHero → RadialRing) and most
 * accent values used to live inside module-level `StyleSheet.create`
 * blocks, which can't call hooks.
 *
 * Every helper below therefore takes the accent as its first argument.
 * `TRIGGERS_ACCENT_FALLBACK` is the old violet, kept only for the
 * default context value so a component rendered outside the provider
 * (tests, Storybook) still paints something sane.
 *
 * Category colours belong here too. They're used by the Personal
 * Insights cards (left color stripe, icon square tint, trend badge)
 * and by the Trigger Distribution intensity dots — the same trigger
 * ID ("stress") should carry the same colour on both surfaces. These
 * are SEMANTIC and deliberately do NOT follow the addiction: "stress"
 * has to stay coral and "boredom" green so the same feeling reads the
 * same across every addiction. Only the module-level `time` category
 * and the unknown-key fallback track the accent.
 */

/** Legacy violet. Only the default context value + tests use it. */
export const TRIGGERS_ACCENT_FALLBACK = '#8f7bf0';

/**
 * Semantic trigger/category colours. Fixed across addictions on
 * purpose — see the module doc above.
 */
export const triggersCategoryColors = {
  // insight rule categories (shared/insightRules → InsightCategory)
  // NOTE: `time` is intentionally absent — it resolves to the
  // addiction accent via `triggersColorFor`.
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
export function triggersColorFor(key: string, accent: string): string {
  const map = triggersCategoryColors as Record<string, string | undefined>;
  return map[key] ?? accent;
}

/**
 * Shared glass-surface tokens for the Triggers cards. Values chosen
 * to sit inside the AmbientGlow-lit detail screen without competing
 * with the addiction's own accent glow above.
 *
 * `border` moved out of this object — it used to bake in a violet
 * tint; call `triggersBorder(accent)` instead.
 */
export const triggersSurface = {
  // Bumped a hair opaquer so cards read clearly on top of the parent
  // detail screen's two AmbientGlow layers + TriggersAurora tint.
  bg: '#131F3A',
  bgElevated: '#1A2748',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  radius: 18,
} as const;

/** Card border — a whisper of the addiction accent. */
export function triggersBorder(accent: string): string {
  return triggersHexAlpha(accent, 0.22);
}

/**
 * Heatmap accent ramp (design brief).
 *   0     → very dim white surface
 *   1–2   → accent @ .28
 *   3–4   → accent @ .55
 *   5+    → accent full (glow drawn separately)
 */
export function triggersHeatmapRamp(
  accent: string
): readonly [string, string, string, string] {
  return [
    'rgba(255,255,255,0.05)',
    triggersHexAlpha(accent, 0.28),
    triggersHexAlpha(accent, 0.55),
    accent, // full, glow layered by cell
  ] as const;
}

/** Bucket a count into the ramp index (0..3). */
export function triggersHeatmapBucket(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

/** Resolve the fill for a heatmap cell given a raw craving count. */
export function triggersHeatmapFill(count: number, accent: string): string {
  return triggersHeatmapRamp(accent)[triggersHeatmapBucket(count)];
}

/** hex → rgba(). Local copy so this module has no external dep. */
export function triggersHexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
