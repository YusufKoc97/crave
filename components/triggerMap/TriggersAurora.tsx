import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GlowDisc } from '@/components/ui/GlowDisc';
import { triggersAccentAlpha } from './triggersTheme';

/**
 * Triggers sub-tab atmospheric layer.
 *
 * Three soft discs sit BEHIND the Insights hero + heatmap so the
 * violet accent bleeds through the spacing and the pane doesn't
 * read as dead cold-navy. Rendered via the shared `GlowDisc`
 * (SVG radial gradient) so the glow shows on native too — the old
 * `filter: blur()` was web-only and vanished on device.
 *
 * Colours are ALL derived from `triggersAccent` — no cyan mid-tone
 * here (that's Toolkit's palette). The Triggers module is violet
 * end-to-end.
 */

type Disc = {
  leftPct: number;
  topPct: number;
  size: number;
  color: string;
};

// Parent detail screen already renders two AmbientGlow layers
// (blue + addiction color), so these discs stay subtle — just
// enough to tint the Triggers pane without dimming the text on top.
const DISCS: readonly Disc[] = [
  { leftPct: 18, topPct: 12, size: 320, color: triggersAccentAlpha(0.14) },
  { leftPct: 82, topPct: 22, size: 260, color: triggersAccentAlpha(0.1) },
  { leftPct: 50, topPct: 62, size: 380, color: triggersAccentAlpha(0.09) },
];

type Props = {
  /** Total height the aurora layer covers. Parent ScrollView clips. */
  height?: number | string;
};

export function TriggersAurora({ height = '100%' }: Props) {
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
