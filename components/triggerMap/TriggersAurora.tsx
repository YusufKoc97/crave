import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GlowDisc } from '@/components/ui/GlowDisc';
import { dsModuleAmbient, hexAlpha } from '@/constants/designSystem';

/**
 * Triggers sub-tab atmospheric layer.
 *
 * Three soft discs sit BEHIND the Insights hero + heatmap so the pane
 * doesn't read as dead flat navy. Rendered via the shared `GlowDisc`
 * (SVG radial gradient) so the glow shows on native too — the old
 * `filter: blur()` was web-only and vanished on device.
 *
 * These discs used to be tinted with the module's violet accent, which
 * washed the whole Triggers tab pale blue and made it the odd one out
 * next to Journey / Toolkit / Comparison. The backdrop is now the
 * shared `dsModuleAmbient` neutral; violet still owns the elements
 * that carry meaning (insight icons, heatmap ramp, distribution dots),
 * it just no longer paints the background.
 */

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
