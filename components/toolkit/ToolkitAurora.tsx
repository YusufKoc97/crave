import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * Toolkit sub-tab atmospheric layer.
 *
 * A small handful of blurred colored discs sit absolutely BEHIND
 * the kicker + segment + carousel so that empty space between
 * the chrome and the cards doesn't read as a dead zone. Deliberately
 * subtle — a hint of colour and depth, no more. The Journey PATH
 * scene owns the "atmosphere" moment on the other tab; this is
 * just the whisper equivalent for Toolkit.
 *
 * Web gets real CSS blur; native fills with softer opacity + no
 * blur (aligned with the AmbientGlow / PathScene pattern). No
 * new deps.
 *
 * Karar #6A — no expo-blur; native fallback is intentionally
 * softer, still reads as ambient colour on the dark bg.
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
  { leftPct: 20, topPct: 15, size: 220, color: 'rgba(120,140,236,0.22)' },
  { leftPct: 78, topPct: 22, size: 180, color: 'rgba(150,120,200,0.18)' },
  { leftPct: 50, topPct: 60, size: 260, color: 'rgba(90,150,170,0.14)' },
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
  // Native fallback: softer opacity, no blur (glass patterns
  // elsewhere in the project follow the same rule).
  return <View style={[base, { opacity: 0.7 }]} />;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
