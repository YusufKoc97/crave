import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GlowDisc } from '@/components/ui/GlowDisc';
import { compColors, compHexAlpha } from './comparisonTheme';

/**
 * Comparison sub-tab atmospheric layer.
 *
 * The parent detail screen (`[addictionId].tsx`) already renders
 * two `<AmbientGlow>` layers (blue anchor + addiction color).
 * ComparisonAurora adds a third — three grey-blue community-tint
 * discs — so the pane reads as its own module without stepping
 * on the addiction color that dominates the header + charts.
 *
 * Renders each disc as an SVG <RadialGradient> (same technique as
 * the design-system `AmbientGlow`) so the glow has a true soft
 * falloff on BOTH web and native — no `filter: blur()` (web-only,
 * which degraded to a hard-edged circle on native). Kept subtle —
 * the design brief calls for a "calmer, data-forward sibling" to
 * Triggers.
 */

type Disc = {
  leftPct: number;
  topPct: number;
  size: number;
  color: string;
};

const DISCS: readonly Disc[] = [
  // Top-left — sits behind the Community Pulse card so the ECG
  // heartbeat has a faint grey-blue backlight.
  {
    leftPct: 20,
    topPct: 10,
    size: 320,
    color: compHexAlpha(compColors.community, 0.14),
  },
  // Top-right — balances the aurora without drawing attention
  // near the dev chip.
  {
    leftPct: 82,
    topPct: 20,
    size: 260,
    color: compHexAlpha(compColors.community, 0.1),
  },
  // Mid-page — sits under the bell-curve cards so their charts
  // have some warmth instead of floating on flat navy.
  {
    leftPct: 50,
    topPct: 60,
    size: 400,
    color: compHexAlpha(compColors.community, 0.09),
  },
];

type Props = {
  /** Total height the aurora layer covers. Parent ScrollView clips. */
  height?: number | string;
};

export function ComparisonAurora({ height = '100%' }: Props) {
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
