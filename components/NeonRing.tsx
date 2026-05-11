import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  size: number;
  /** Stroke / border width of the ring. */
  strokeWidth?: number;
  /** Bright neon color (head of the gradient). */
  color?: string;
  /** Direction of rotation. */
  direction?: 'cw' | 'ccw';
  /** One full turn duration in ms. */
  duration?: number;
  /** Track ring opacity (faint full-circle behind the rotating arc). */
  trackOpacity?: number;
};

/**
 * Two-layer neon loading ring: a faint full-circle "track" behind a rotating
 * partial-arc head with a soft outer glow. Continuous (no comet segments)
 * so it reads as a clean spinning arc — not a worm trail.
 */
export function NeonRing({
  size,
  strokeWidth = 1.5,
  color = '#7DC3FF',
  direction = 'cw',
  duration = 4200,
  trackOpacity = 0.18,
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

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const radius = size / 2;

  return (
    <View
      style={[styles.wrap, { width: size, height: size, borderRadius: radius }]}
      pointerEvents="none"
    >
      {/* Faint full-circle track */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: hexToRgba(color, trackOpacity),
          },
        ]}
      />

      {/* Rotating bright arc — top brightest, fades away clockwise */}
      <Animated.View
        style={[
          styles.ring,
          styles.glow,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderTopColor: hexToRgba(color, 1),
            borderRightColor: hexToRgba(color, 0.55),
            borderBottomColor: 'transparent',
            borderLeftColor: hexToRgba(color, 0.18),
            shadowColor: color,
          },
          arcStyle,
        ]}
      />
    </View>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  glow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 8,
    ...Platform.select({
      web: {
        boxShadow:
          '0 0 6px rgba(125, 195, 255, 0.7), 0 0 14px rgba(125, 195, 255, 0.35)',
      },
      default: {},
    }),
  },
});
