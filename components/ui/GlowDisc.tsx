import { useRef } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * A single soft radial-gradient glow disc, positioned by percentage
 * inside its parent.
 *
 * Uses `react-native-svg` <RadialGradient> so the falloff is a true
 * soft glow on BOTH web and native. The auroras used to paint a
 * `filter: blur()` <View> on web and fall back to a hard-edged
 * circle (or nothing) on native — invisible on device. A radial
 * gradient gives the same look everywhere with no `filter`, no
 * `expo-blur` dependency (karar #6A), and no shadow-hack math.
 *
 * `color` should already carry its target alpha (e.g. via hexAlpha);
 * the gradient fades that colour out to transparent at the edge.
 */

// Monotonic id source. `useId()` is unusable here — its `:r0:`
// output is an invalid SVG id and breaks `url(#…)` references.
let gradSeq = 0;

type Props = {
  leftPct: number;
  topPct: number;
  /** Diameter in pt. */
  size: number;
  color: string;
};

export function GlowDisc({ leftPct, topPct, size, color }: Props) {
  // Stable unique id per mounted disc — avoids SVG <defs> id
  // collisions on web (single DOM) when many discs share a screen.
  const id = useRef(`glowDisc${(gradSeq += 1)}`).current;

  const base: ViewStyle = {
    position: 'absolute',
    left: `${leftPct}%`,
    top: `${topPct}%`,
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
  };

  return (
    <View pointerEvents="none" style={base}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient
            id={id}
            cx="50"
            cy="50"
            rx="50"
            ry="50"
            fx="50"
            fy="50"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={1} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
