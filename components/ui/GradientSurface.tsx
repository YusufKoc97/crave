import { useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

// Monotonic counter → globally-unique SVG gradient ids. react-native-svg
// resolves `url(#id)` against a shared registry on native, so two mounted
// instances sharing a hardcoded id repaint each other's gradient.
let gsSeq = 0;

/**
 * Cross-platform card gradient fill.
 *
 * React Native has no `backgroundImage` — web-only radial/linear CSS
 * gradients collapse to a flat `backgroundColor` on iOS/Android, which
 * is why the rich card surfaces looked washed-out on device. This
 * primitive paints the same top→bottom base plus an optional accent
 * bloom from the top edge with `react-native-svg` (userSpaceOnUse in a
 * stretched 100×100 box — identical technique to GlowDisc/AmbientGlow),
 * so the design renders faithfully on both platforms.
 *
 * Drop it in as the first child of a clipped (overflow:hidden) card
 * frame; it fills the frame and sits behind the content.
 */
type Props = {
  /** Top base colour of the vertical gradient. */
  top: string;
  /** Bottom base colour of the vertical gradient. */
  bottom: string;
  /** Optional accent colour for the top-edge radial bloom. */
  accent?: string;
  /** Accent opacity at the bloom centre. */
  accentPeak?: number;
  /** Accent opacity at the 55% falloff stop. */
  accentMid?: number;
  /** Match the parent's corner radius so the fill clips cleanly. */
  radius?: number;
  style?: ViewStyle;
};

export function GradientSurface({
  top,
  bottom,
  accent,
  accentPeak = 0.2,
  accentMid = 0.05,
  radius,
  style,
}: Props) {
  const uid = useRef((gsSeq += 1)).current;
  const linId = `gsLin${uid}`;
  const radId = `gsRad${uid}`;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        radius !== undefined
          ? { borderRadius: radius, overflow: 'hidden' }
          : null,
        style,
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Defs>
          {/* ~160deg base — mostly downward, slight lateral drift. */}
          <LinearGradient
            id={linId}
            x1="12"
            y1="0"
            x2="0"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={top} />
            <Stop offset="100%" stopColor={bottom} />
          </LinearGradient>
          {accent ? (
            <RadialGradient
              id={radId}
              cx="50"
              cy="-5"
              rx="72"
              ry="62"
              fx="50"
              fy="-5"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={accent} stopOpacity={accentPeak} />
              <Stop offset="55%" stopColor={accent} stopOpacity={accentMid} />
              <Stop offset="100%" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          ) : null}
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${linId})`} />
        {accent ? (
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${radId})`} />
        ) : null}
      </Svg>
    </View>
  );
}
