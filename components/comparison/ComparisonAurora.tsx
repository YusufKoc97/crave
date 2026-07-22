import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
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
 * Same web/native fallback pattern as `TriggersAurora`: real CSS
 * blur on web, opacity fade on native (karar #6A — no expo-blur).
 * Kept very subtle (opacity 0.05–0.09) — the design brief calls
 * for a "calmer, data-forward sibling" to Triggers.
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
    size: 220,
    color: compHexAlpha(compColors.community, 0.09),
  },
  // Top-right — balances the aurora without drawing attention
  // near the dev chip.
  {
    leftPct: 82,
    topPct: 20,
    size: 180,
    color: compHexAlpha(compColors.community, 0.06),
  },
  // Mid-page — sits under the bell-curve cards so their charts
  // have some warmth instead of floating on flat navy.
  {
    leftPct: 50,
    topPct: 60,
    size: 280,
    color: compHexAlpha(compColors.community, 0.05),
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
  return <View style={[base, { opacity: 0.5 }]} />;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
