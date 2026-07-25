import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GlowDisc } from '@/components/ui/GlowDisc';

/**
 * Toolkit sub-tab atmospheric layer.
 *
 * A small handful of soft colored discs sit absolutely BEHIND
 * the kicker + segment + carousel so that empty space between
 * the chrome and the cards doesn't read as a dead zone. Deliberately
 * subtle — a hint of colour and depth, no more. The Journey PATH
 * scene owns the "atmosphere" moment on the other tab; this is
 * just the whisper equivalent for Toolkit.
 *
 * Rendered via the shared `GlowDisc` (SVG radial gradient) so the
 * glow shows on native too — the old `filter: blur()` was web-only.
 * No new deps.
 */

type Disc = {
  leftPct: number;
  topPct: number;
  size: number;
  color: string;
};

/** Three discs — blue anchor, purple midpoint, teal accent.
 *  Kept small + low-alpha so they don't fight the cards' own
 *  scene glows for attention. */
const DISCS: readonly Disc[] = [
  { leftPct: 20, topPct: 15, size: 320, color: 'rgba(120,140,236,0.26)' },
  { leftPct: 78, topPct: 22, size: 260, color: 'rgba(150,120,200,0.2)' },
  { leftPct: 50, topPct: 60, size: 380, color: 'rgba(90,150,170,0.16)' },
];

type Props = {
  /** Total height the aurora layer should cover. Defaults to
   *  the pane height (the parent ScrollView clips beyond that). */
  height?: number | string;
};

export function ToolkitAurora({ height = '100%' }: Props) {
  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { height } as ViewStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {DISCS.map((d, i) => (
        <GlowDisc key={i} {...d} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
