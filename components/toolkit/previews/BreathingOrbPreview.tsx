import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../useReducedMotion';

/**
 * 4-7-8 Breathing preview — a central white orb that expands and
 * contracts to the 4-in / 7-hold / 8-out rhythm. Living metaphor
 * of the technique: user sees the breath before ever tapping play.
 *
 * Single Reanimated shared value drives both scale and opacity.
 * Cycle duration: 19 seconds (same as the real breathing screen).
 * Reduced-motion: rests at mid-scale, no animation loop.
 */
export function BreathingOrbPreview() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      t.value = 0.5;
      return;
    }
    // t sweeps 0 → 1 (inhale, 4s) → hold at 1 (7s) → 0 (exhale, 8s).
    // withSequence chains the three phases; withRepeat loops forever.
    t.value = 0;
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 7000 }), // hold
        withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [reduced, t]);

  const orbStyle = useAnimatedStyle(() => ({
    // Scale 0.55 → 1.0 (feels embodied without hitting the panel below)
    transform: [{ scale: 0.55 + t.value * 0.45 }],
    // Opacity 0.35 → 0.9 as it grows
    opacity: 0.35 + t.value * 0.55,
  }));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.orb, orbStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#ffffff',
    // Soft white glow — pairs with the scene's purple/pink hues.
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
  },
});
