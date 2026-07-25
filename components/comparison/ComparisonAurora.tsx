import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GlowDisc } from '@/components/ui/GlowDisc';
import { dsModuleAmbient, hexAlpha } from '@/constants/designSystem';

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
 *
 * Disc colour + placement now come from `dsModuleAmbient`, which the
 * Toolkit and Triggers auroras share, so the four Info sub-tabs read
 * as one continuous navy instead of three different hues.
 */

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
      {dsModuleAmbient.discs.map((d, i) => (
        <GlowDisc
          key={i}
          leftPct={d.leftPct}
          topPct={d.topPct}
          size={d.size}
          color={hexAlpha(dsModuleAmbient.color, d.alpha)}
        />
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
