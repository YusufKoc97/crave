import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GlowDisc } from '@/components/ui/GlowDisc';
import { dsModuleAmbient, hexAlpha } from '@/constants/designSystem';

/**
 * Toolkit sub-tab atmospheric layer.
 *
 * A small handful of soft discs sit absolutely BEHIND the kicker +
 * segment + carousel so that empty space between the chrome and the
 * cards doesn't read as a dead zone. Deliberately subtle — a hint of
 * depth, no more. The Journey PATH scene owns the "atmosphere" moment
 * on the other tab; this is just the whisper equivalent for Toolkit.
 *
 * Colours come from `dsModuleAmbient`, shared with the Triggers and
 * Comparison auroras. This layer used to mix its own blue / purple /
 * teal discs, which made the Toolkit tab a visibly different hue from
 * its three siblings — the four modules are meant to share one navy.
 *
 * Rendered via the shared `GlowDisc` (SVG radial gradient) so the
 * glow shows on native too — the old `filter: blur()` was web-only.
 * No new deps.
 */

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
