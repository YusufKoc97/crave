import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { triggersAccentAlpha } from './triggersTheme';

/**
 * Triggers sub-tab atmospheric layer.
 *
 * Three blurred discs sit BEHIND the Insights hero + heatmap so the
 * violet accent bleeds through the spacing and the pane doesn't
 * read as dead cold-navy. Same visual grammar as `ToolkitAurora`
 * (karar #6A — no expo-blur; web gets real blur, native falls back
 * to fill + opacity).
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
// (blue + addiction color), so these discs stay VERY subtle —
// just enough to tint the Triggers pane without dimming the
// text that sits on top.
const DISCS: readonly Disc[] = [
  { leftPct: 18, topPct: 12, size: 220, color: triggersAccentAlpha(0.09) },
  { leftPct: 82, topPct: 22, size: 180, color: triggersAccentAlpha(0.06) },
  { leftPct: 50, topPct: 62, size: 260, color: triggersAccentAlpha(0.05) },
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
        <AuroraDisc key={i} {...d} />
      ))}
    </View>
  );
}

function AuroraDisc({ leftPct, topPct, size, color }: Disc) {
  const base: ViewStyle = {
    position: 'absolute',
    left: `${leftPct}%`,
    top: `${topPct}%`,
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
    borderRadius: size / 2,
    backgroundColor: color,
  };
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <View style={{ ...base, filter: 'blur(28px)' } as any} />;
  }
  // Native fallback: softer opacity, no blur — same rule the rest
  // of the app follows for ambient layers.
  return <View style={[base, { opacity: 0.5 }]} />;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
