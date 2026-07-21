import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { triggersAccent, triggersAccentAlpha } from '../triggersTheme';

/**
 * Radial % ring used by the insights hero card.
 *
 * Faithful to the design brief `ringDraw` animation: on mount the
 * stroke starts fully offset (invisible) and animates down to the
 * final dashoffset so the arc appears to "draw itself". Reduced-
 * motion users get the final state instantly, no animation.
 *
 * Sizing kept flexible via `size` prop so we can reuse the same
 * primitive for a smaller variant later (peak-card rings, etc.)
 * without duplicating the geometry.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0-100. Values outside are clamped by the caller (heroData). */
  percent: number;
  /** Outer diameter of the SVG. Defaults to 72 (hero size). */
  size?: number;
  /** Stroke thickness. Defaults to 6. */
  stroke?: number;
  /** Ring accent colour. Defaults to Triggers violet. */
  color?: string;
  /** Child rendered centered inside the ring (usually the big value). */
  children?: React.ReactNode;
};

export function RadialRing({
  percent,
  size = 72,
  stroke = 6,
  color = triggersAccent,
  children,
}: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Reanimated shared value driving stroke-dashoffset: starts at
  // circumference (empty), animates to the target offset (filled).
  const offset = useSharedValue(circumference);

  useEffect(() => {
    let cancelled = false;
    // Respect reduced-motion — go straight to final state.
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      const target =
        circumference * (1 - Math.max(0, Math.min(100, percent)) / 100);
      if (reduced) {
        offset.value = target;
      } else {
        offset.value = withTiming(target, {
          duration: 900,
          easing: Easing.out(Easing.cubic),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [percent, circumference, offset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Rotate -90° so the arc starts at 12 o'clock. */}
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          {/* Track — a soft violet base ring so the arc has something
              to grow into visually even at 0%. */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={triggersAccentAlpha(0.18)}
            strokeWidth={stroke}
            fill="none"
          />
          {/* Foreground arc — animated dashoffset draws it in. */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={animatedProps}
          />
        </G>
      </Svg>
      {children}
    </View>
  );
}
