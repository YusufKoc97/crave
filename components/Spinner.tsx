import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  size: number;
  strokeWidth?: number;
  color?: string;
  direction?: 'cw' | 'ccw';
  duration?: number;
  /** Visible arc as a fraction of circumference (0-1). Default 0.30. */
  arcFraction?: number;
};

/**
 * Smooth SVG-based loading spinner. Uses a single arc with rounded caps,
 * plus two fading trail arcs for a soft comet-trail look. Rotates linearly.
 */
export function Spinner({
  size,
  strokeWidth = 1.5,
  color = 'rgba(125, 195, 255, 1)',
  direction = 'cw',
  duration = 3200,
  arcFraction = 0.3,
}: Props) {
  const rotate = useSharedValue(0);

  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(direction === 'cw' ? 360 : -360, {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [direction, duration, rotate]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const r = (size - strokeWidth * 2) / 2;
  const c = 2 * Math.PI * r;
  const headLen = c * arcFraction * 0.45;
  const midLen = c * arcFraction * 0.30;
  const tailLen = c * arcFraction * 0.25;
  const gap = 6;

  // Three arcs laid back-to-back with decreasing opacity → comet trail.
  const cx = size / 2;
  const cy = size / 2;

  return (
    <Animated.View
      style={[styles.wrap, { width: size, height: size }, wrapStyle]}
      pointerEvents="none"
    >
      <Svg width={size} height={size}>
        {/* Head (brightest) */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${headLen} ${c}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          opacity={1}
        />
        {/* Mid */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${midLen} ${c}`}
          strokeDashoffset={-(headLen + gap)}
          strokeLinecap="round"
          opacity={0.55}
        />
        {/* Tail */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${tailLen} ${c}`}
          strokeDashoffset={-(headLen + midLen + gap * 2)}
          strokeLinecap="round"
          opacity={0.22}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
});
