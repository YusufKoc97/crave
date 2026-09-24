import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';

/** Gradient ids come from a module-level counter, not `useId()`:
 *  React emits ":r0:", which is not a valid SVG identifier, and
 *  hardcoded ids collide in react-native-svg's shared registry once a
 *  second instance mounts. Same rule as `addictionPicker/fills.tsx`. */
let gradSeq = 0;

/** Same brightness on every edge. Edges meet on a 45° miter, and the two
 *  gradients only agree along that seam if their peaks are equal; with
 *  unequal peaks (as before) the corner shows a visible step. */
const PEAK_ALPHA = 0.42;

/**
 * The four glow edges as ONE mitered frame.
 *
 * Each edge is a trapezoid whose slanted ends meet its neighbours on the
 * corner diagonal, so nothing overlaps. (The earlier version laid four
 * full-length rectangles over each other: at every corner the top and
 * side strips summed into a brighter, hard-edged square — the "pointy,
 * cheap" corners.) Drawn in pixel space (`userSpaceOnUse`) from the
 * measured size, because a percentage-based gradient can't express the
 * miter, and the fractional `objectBoundingBox` form is unreliable on
 * native anyway (see `addictionPicker/fills.tsx`).
 *
 * `depth` is the reach from the top/bottom edges, `sideDepth` from the
 * left/right ones — a phone is much taller than wide, so equal depths make
 * the sides feel heavier.
 */
function Frame({
  w,
  h,
  color,
  depth,
  sideDepth,
}: {
  w: number;
  h: number;
  color: string;
  depth: number;
  sideDepth: number;
}) {
  const [ids] = useState(() => {
    const n = (gradSeq += 1);
    return {
      top: `neonTop${n}`,
      bottom: `neonBottom${n}`,
      left: `neonLeft${n}`,
      right: `neonRight${n}`,
    };
  });
  const d = Math.min(depth, h / 2);
  const sd = Math.min(sideDepth, w / 2);

  // Mid stop pulls the falloff toward the border. A plain two-stop ramp
  // spreads the tint too evenly and reads as a wash over the content
  // rather than light coming off the bezel.
  const stops = [
    <Stop key="a" offset="0%" stopColor={color} stopOpacity={PEAK_ALPHA} />,
    <Stop
      key="b"
      offset="45%"
      stopColor={color}
      stopOpacity={PEAK_ALPHA * 0.2}
    />,
    <Stop key="c" offset="100%" stopColor={color} stopOpacity={0} />,
  ];

  return (
    <Svg
      pointerEvents="none"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <LinearGradient
          id={ids.top}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={0}
          x2={0}
          y2={d}
        >
          {stops}
        </LinearGradient>
        <LinearGradient
          id={ids.bottom}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={h}
          x2={0}
          y2={h - d}
        >
          {stops}
        </LinearGradient>
        <LinearGradient
          id={ids.left}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={0}
          x2={sd}
          y2={0}
        >
          {stops}
        </LinearGradient>
        <LinearGradient
          id={ids.right}
          gradientUnits="userSpaceOnUse"
          x1={w}
          y1={0}
          x2={w - sd}
          y2={0}
        >
          {stops}
        </LinearGradient>
      </Defs>
      <Polygon
        points={`0,0 ${w},0 ${w - sd},${d} ${sd},${d}`}
        fill={`url(#${ids.top})`}
      />
      <Polygon
        points={`0,${h} ${w},${h} ${w - sd},${h - d} ${sd},${h - d}`}
        fill={`url(#${ids.bottom})`}
      />
      <Polygon
        points={`0,0 ${sd},${d} ${sd},${h - d} 0,${h}`}
        fill={`url(#${ids.left})`}
      />
      <Polygon
        points={`${w},0 ${w - sd},${d} ${w - sd},${h - d} ${w},${h}`}
        fill={`url(#${ids.right})`}
      />
    </Svg>
  );
}

type Props = {
  /** Neon color — pass the addiction accent so the frame is color-locked
   *  to whatever craving the session belongs to. */
  color: string;
  /** How far the glow reaches inward from the long (top/bottom) edges. */
  depth?: number;
  /** How far it reaches in from the side edges. Narrower by default —
   *  a phone is much taller than it is wide, so equal depths make the
   *  sides feel heavier than the top. */
  sideDepth?: number;
  /** One full breath (dim → bright → dim) in ms. */
  duration?: number;
  /** Group opacity at the dim end of the breath. */
  minOpacity?: number;
  /** Group opacity at the bright end. */
  maxOpacity?: number;
  /** Corner radius of the frame. Should match the surface it hugs (the
   *  modal sheet / device corner) so the glow follows the curve instead of
   *  ending in a square corner. */
  cornerRadius?: number;
};

/**
 * Slow-breathing neon vignette drawn around the screen border.
 *
 * Used on the active-session screen to mark the craving as a moment
 * that is actually happening to you — the frame is doing the work an
 * alert banner would otherwise have to do, without taking any layout
 * space or competing with the timer for the center of the screen.
 *
 * Deliberately built from gradient strips rather than a glowing
 * border: RN has no inset box-shadow on native, and `boxShadow` is a
 * web-only style that would silently render nothing on device. Four
 * SVG gradients look identical on iOS, Android and web.
 *
 * Purely decorative — `pointerEvents="none"` throughout, and the
 * animation is skipped entirely when the OS reports reduced motion.
 */
export function NeonFrame({
  color,
  depth = 108,
  sideDepth = 72,
  duration = 5200,
  minOpacity = 0.3,
  maxOpacity = 1,
  cornerRadius = 40,
}: Props) {
  const breath = useSharedValue(minOpacity);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height }
    );
  };

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (!cancelled) setReducedMotion(r);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (r) => {
        if (!cancelled) setReducedMotion(r);
      }
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(breath);
      // Hold at the midpoint rather than the dim end: the frame still
      // has to read as a deliberate accent, just a motionless one.
      breath.value = (minOpacity + maxOpacity) / 2;
      return;
    }
    breath.value = minOpacity;
    breath.value = withRepeat(
      withTiming(maxOpacity, {
        // Half a breath per timing pass — withRepeat's `reverse` flag
        // plays the return leg, so `duration` stays the full cycle.
        duration: duration / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
    return () => cancelAnimation(breath);
  }, [breath, reducedMotion, duration, minOpacity, maxOpacity]);

  const style = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: cornerRadius, overflow: 'hidden' },
        style,
      ]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {size.w > 0 ? (
        <Frame
          w={size.w}
          h={size.h}
          color={color}
          depth={depth}
          sideDepth={sideDepth}
        />
      ) : null}
      {/* Hairline tube along the very edge. Without it the gradients
          read as a soft haze; the crisp line is what makes the whole
          thing land as "neon". Rounded to match the frame. */}
      <View
        pointerEvents="none"
        style={[
          styles.tube,
          { borderColor: color, borderRadius: cornerRadius },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tube: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    // The border color is injected at render; opacity dims the raw
    // accent here so the line sits under the gradient bloom instead
    // of outlining the screen like a debug box.
    opacity: 0.55,
  },
});
