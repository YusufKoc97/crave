import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Design-system atmosphere primitive.
 *
 * Renders a soft radial-gradient glow behind whatever's placed above
 * it. Uses `react-native-svg` <RadialGradient> for a true radial
 * falloff — cross-platform, no new dependency, no shadow-hack math.
 *
 * The wrapper animates *opacity* rather than tweening gradient
 * stops so the pulse stays on the compositor and the SVG parse
 * cost is paid once. `pulse=false` renders a static layer.
 *
 * Intensity buckets are locked to the brief's "never over 25%
 * opacity at peak" ceiling. Increase the numbers only if the
 * design changes.
 */

type Intensity = 'low' | 'medium' | 'high';

const INTENSITY_STOPS: Record<
  Intensity,
  { center: number; peak: number; min: number }
> = {
  low: { center: 0.1, peak: 0.15, min: 0.08 },
  medium: { center: 0.18, peak: 0.22, min: 0.14 },
  high: { center: 0.25, peak: 0.25, min: 0.18 },
};

type Props = {
  /** Any CSS-parseable colour — hex, rgb, rgba. */
  color: string;
  /** Circle diameter in pt. Actual paint area is 2×size (glow spills). */
  size: number;
  intensity?: Intensity;
  /** Overrides the wrapper's absolute position. Defaults to centered. */
  position?: { x: number; y: number };
  /** Slow 3.5s pulse. Defaults to true. */
  pulse?: boolean;
  /** Extra style hook for parents (e.g. clipping to a card). */
  style?: ViewStyle;
};

export function AmbientGlow({
  color,
  size,
  intensity = 'medium',
  position,
  pulse = true,
  style,
}: Props) {
  const stops = INTENSITY_STOPS[intensity];
  const opacity = useSharedValue(pulse ? stops.min : stops.center);

  useEffect(() => {
    if (!pulse) {
      opacity.value = stops.center;
      return;
    }
    // 3.5s each way = 7s round-trip → subtle, battery-friendly.
    opacity.value = withRepeat(
      withTiming(stops.peak, {
        duration: 3500,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, [pulse, opacity, stops.center, stops.peak]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const wrapperStyle: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    ...(position
      ? { left: position.x - size / 2, top: position.y - size / 2 }
      : {
          left: '50%',
          top: '50%',
          marginLeft: -size / 2,
          marginTop: -size / 2,
        }),
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[wrapperStyle, animatedStyle, style]}
    >
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient
              id="glow"
              cx="50"
              cy="50"
              rx="50"
              ry="50"
              fx="50"
              fy="50"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={color} stopOpacity={1} />
              <Stop offset="45%" stopColor={color} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#glow)" />
        </Svg>
      </View>
    </Animated.View>
  );
}
