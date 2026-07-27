import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

/** SVG gradient ids must be unique per document — on web every <Svg>
 *  shares one id namespace, so a hardcoded id would make all four
 *  edges resolve to whichever <Defs> mounted last. A module-level
 *  counter is used instead of useId() because React's id format
 *  (":r0:") is not a valid SVG identifier. */
let gradSeq = 0;

type EdgeName = 'top' | 'bottom' | 'left' | 'right';

/** Gradient vector per edge, in fractional (objectBoundingBox) units.
 *  Each runs from the screen border inward, so the bright stop always
 *  sits against the bezel and fades toward the content. */
const EDGE_VECTORS: Record<
  EdgeName,
  { x1: string; y1: string; x2: string; y2: string }
> = {
  top: { x1: '0', y1: '0', x2: '0', y2: '1' },
  bottom: { x1: '0', y1: '1', x2: '0', y2: '0' },
  left: { x1: '0', y1: '0', x2: '1', y2: '0' },
  right: { x1: '1', y1: '0', x2: '0', y2: '0' },
};

/**
 * One edge of the frame: a strip of the given depth holding a single
 * rect filled with an accent→transparent gradient.
 *
 * Sized with width/height "100%" against a 1×1 viewBox and
 * `preserveAspectRatio="none"`, which means the component never has
 * to measure the window. The gradient coordinates are fractional, so
 * they stretch with the strip on any screen size or orientation
 * without a re-layout pass.
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
  const [gradId] = useState(() => `neonFrame${gradSeq++}`);
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
        width="100%"
        height="100%"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={gradId} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
            <Stop offset="0" stopColor={color} stopOpacity={peakAlpha} />
            {/* Mid stop pulls the falloff toward the border. A plain
                two-stop ramp spreads the tint too evenly and reads as
                a wash over the content rather than light coming off
                the bezel. */}
            <Stop
              offset="0.45"
              stopColor={color}
              stopOpacity={peakAlpha * 0.2}
            />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradId})`} />
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
