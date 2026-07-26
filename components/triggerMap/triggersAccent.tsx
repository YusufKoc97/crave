import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  TRIGGERS_ACCENT_FALLBACK,
  triggersColorFor,
  triggersHeatmapFill,
  triggersHexAlpha,
} from './triggersTheme';

/**
 * Accent distribution for the Triggers sub-tab.
 *
 * Modül 3 originally hard-coded violet, so opening Smoking (gold) and
 * tapping Triggers snapped the whole pane to violet while the sibling
 * Comparison tab stayed gold. `TriggersPane` now provides
 * `addiction.color` here and every descendant reads it.
 *
 * A context rather than prop-drilling because the tree is four levels
 * deep in places (Pane → InsightSection → InsightsHero → RadialRing)
 * and the accent used to be baked into module-level `StyleSheet`
 * blocks, which can't call hooks — the values that moved out of those
 * blocks now come from here as inline style overrides.
 */

type TriggersAccentValue = {
  /** The addiction's colour — the module accent. */
  accent: string;
  /** accent at a given alpha. */
  alpha: (a: number) => string;
  /** Trigger-id / category colour, accent as fallback. */
  colorFor: (key: string) => string;
  /** Heatmap cell fill for a raw craving count. */
  heatmapFill: (count: number) => string;
};

const TriggersAccentContext = createContext<TriggersAccentValue | null>(null);

export function TriggersAccentProvider({
  accent,
  children,
}: {
  accent: string;
  children: ReactNode;
}) {
  const value = useMemo<TriggersAccentValue>(
    () => ({
      accent,
      alpha: (a: number) => triggersHexAlpha(accent, a),
      colorFor: (key: string) => triggersColorFor(key, accent),
      heatmapFill: (count: number) => triggersHeatmapFill(count, accent),
    }),
    [accent]
  );

  return (
    <TriggersAccentContext.Provider value={value}>
      {children}
    </TriggersAccentContext.Provider>
  );
}

/**
 * Read the module accent. Falls back to the legacy violet when a
 * component renders outside the provider (unit tests, isolated
 * previews) so nothing crashes or renders colourless.
 */
export function useTriggersAccent(): TriggersAccentValue {
  const ctx = useContext(TriggersAccentContext);
  return useMemo<TriggersAccentValue>(() => {
    if (ctx) return ctx;
    const accent = TRIGGERS_ACCENT_FALLBACK;
    return {
      accent,
      alpha: (a: number) => triggersHexAlpha(accent, a),
      colorFor: (key: string) => triggersColorFor(key, accent),
      heatmapFill: (count: number) => triggersHeatmapFill(count, accent),
    };
  }, [ctx]);
}
