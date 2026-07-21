import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../useReducedMotion';

/**
 * 5-4-3-2-1 Grounding preview — five dots in a row, each pulsing
 * in sequence with a 0.42s stagger so they read as a "1 → 2 → 3
 * → 4 → 5, count each one" cadence. Loops every ~4 seconds.
 */

const COUNT = 5;
const STAGGER_MS = 420;
const PULSE_UP_MS = 600;
const PULSE_HOLD_MS = 200;
const PULSE_DOWN_MS = 800;
const LOOP_TOTAL_MS = 4200; // gives a beat of silence between loops

export function GroundingDotsPreview() {
  const reduced = useReducedMotion();
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.row}>
        {Array.from({ length: COUNT }, (_, i) => (
          <PulseDot key={i} index={i} reduced={reduced} />
        ))}
      </View>
    </View>
  );
}

function PulseDot({ index, reduced }: { index: number; reduced: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      t.value = 0.4;
      return;
    }
    // Each dot starts its pulse after (index * STAGGER_MS) delay,
    // then repeats every LOOP_TOTAL_MS.
    t.value = 0;
    t.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: PULSE_UP_MS,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(1, { duration: PULSE_HOLD_MS }),
          withTiming(0, {
            duration: PULSE_DOWN_MS,
            easing: Easing.in(Easing.quad),
          }),
          withTiming(0, {
            duration:
              LOOP_TOTAL_MS - PULSE_UP_MS - PULSE_HOLD_MS - PULSE_DOWN_MS,
          })
        ),
        -1,
        false
      )
    );
  }, [index, reduced, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + t.value * 0.35 }],
    opacity: 0.35 + t.value * 0.65,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
});
