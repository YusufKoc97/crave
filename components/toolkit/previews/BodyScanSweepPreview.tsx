import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../useReducedMotion';

/**
 * Body Scan preview — a thin horizontal line drifts from the top
 * of the card to the bottom in 5 seconds, then jumps back and
 * repeats. Reads like a medical scanner or airport body-scan
 * light, matching the technique's "notice tension zone by zone"
 * intent.
 */

const SCAN_DURATION_MS = 5000;
const REST_DURATION_MS = 800;

export function BodyScanSweepPreview() {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      y.value = 0.5;
      opacity.value = 0.5;
      return;
    }
    // y sweeps 0 → 1 (top to bottom) then instantly snaps back.
    y.value = 0;
    y.value = withRepeat(
      withTiming(1, {
        duration: SCAN_DURATION_MS + REST_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false
    );
    // Opacity fades in at the start, holds, fades out at the end
    // of each sweep — softens the loop restart.
    opacity.value = 0;
    opacity.value = withRepeat(
      withTiming(1, {
        duration: SCAN_DURATION_MS + REST_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [reduced, y, opacity]);

  const scanStyle = useAnimatedStyle(() => {
    // Constrain to the top 75% of the card so the line disappears
    // behind the glass panel by the time it hits the bottom.
    const top = `${y.value * 75}%` as `${number}%`;
    // Opacity envelope: fade in over first 15%, hold, fade out
    // during last 15% of the sweep. During the rest window (final
    // 800ms of the loop) stays at 0.
    const scanFraction =
      SCAN_DURATION_MS / (SCAN_DURATION_MS + REST_DURATION_MS);
    let alpha: number;
    if (y.value < 0.05) alpha = y.value / 0.05;
    else if (y.value < scanFraction - 0.05) alpha = 1;
    else if (y.value < scanFraction) alpha = (scanFraction - y.value) / 0.05;
    else alpha = 0;
    return {
      top,
      opacity: alpha,
    };
  });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.scanLine, scanStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
});
