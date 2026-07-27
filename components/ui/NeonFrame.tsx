import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Gradient ids come from a module-level counter, not `useId()`:
 *  React emits ":r0:", which is not a valid SVG identifier, and
 *  hardcoded ids collide in react-native-svg's shared registry once a
 *  second instance mounts. Same rule as `addictionPicker/fills.tsx`. */
let gradSeq = 0;

type EdgeName = 'top' | 'bottom' | 'left' | 'right';

/** Gradient vector per edge, in the fixed 0–100 user space below. Each
 *  runs from the screen border inward, so the bright stop always sits
 *  against the bezel and fades toward the content. */
const EDGE_VECTORS: Record<
  EdgeName,
  { x1: number; y1: number; x2: number; y2: number }
> = {
  top: { x1: 0, y1: 0, x2: 0, y2: 100 },
  bottom: { x1: 0, y1: 100, x2: 0, y2: 0 },
  left: { x1: 0, y1: 0, x2: 100, y2: 0 },
  right: { x1: 100, y1: 0, x2: 0, y2: 0 },
};

/**
 * One edge of the frame: a strip of the given depth holding a single
 * accent→transparent gradient.
 *
 * Three sizing/compat rules are load-bearing here:
 *
 * - `gradientUnits="userSpaceOnUse"` with numeric coordinates. The
 *   fractional `objectBoundingBox` form is unreliable on native — the
 *   same lesson recorded in the header of `addictionPicker/fills.tsx`.
 *   An earlier revision of this file used it and rendered correctly on
 *   web, which would have made it an iOS-only failure.
 * - Explicit `width="100%" height="100%"`. With only an absolute-fill
 *   style, react-native-svg infers the element's height from the
 *   viewBox aspect ratio, so a square 100×100 box forces a square
 *   element: these strips collapsed to 361×361 and 72×72 instead of
 *   361×108 and 72×738. Every other gradient surface in the app
 *   (AmbientGlow, GlowDisc, GradientSurface) sets both for this
 *   reason.
 * - `preserveAspectRatio="none"` so the square user space stretches to
 *   fill a very non-square strip.
 */
function Edge({
  edge,
  color,
  depth,
  peakAlpha,
}: {
  edge: EdgeName;
  color: string;
  depth: number;
  peakAlpha: number;
}) {
  const [gradId] = useState(() => `neonFrame${(gradSeq += 1)}`);
  const v = EDGE_VECTORS[edge];

  const box =
    edge === 'top'
      ? { top: 0, left: 0, right: 0, height: depth }
      : edge === 'bottom'
        ? { bottom: 0, left: 0, right: 0, height: depth }
        : edge === 'left'
          ? { top: 0, bottom: 0, left: 0, width: depth }
          : { top: 0, bottom: 0, right: 0, width: depth };

  return (
    <View style={[styles.edge, box]} pointerEvents="none">
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient
            id={gradId}
            x1={v.x1}
            y1={v.y1}
            x2={v.x2}
            y2={v.y2}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={peakAlpha} />
            {/* Mid stop pulls the falloff toward the border. A plain
                two-stop ramp spreads the tint too evenly and reads as
                a wash over the content rather than light coming off
                the bezel. */}
            <Stop
              offset="45%"
              stopColor={color}
              stopOpacity={peakAlpha * 0.2}
            />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradId})`} />
      </Svg>
    </View>
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
}: Props) {
  const breath = useSharedValue(minOpacity);

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
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    >
      <Edge edge="top" color={color} depth={depth} peakAlpha={0.5} />
      <Edge edge="bottom" color={color} depth={depth} peakAlpha={0.42} />
      <Edge edge="left" color={color} depth={sideDepth} peakAlpha={0.34} />
      <Edge edge="right" color={color} depth={sideDepth} peakAlpha={0.34} />
      {/* Hairline tube along the very edge. Without it the gradients
          read as a soft haze; the crisp line is what makes the whole
          thing land as "neon". */}
      <View
        pointerEvents="none"
        style={[styles.tube, { borderColor: color }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
  },
  tube: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    // The border color is injected at render; opacity dims the raw
    // accent here so the line sits under the gradient bloom instead
    // of outlining the screen like a debug box.
    opacity: 0.55,
  },
});
