import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { hapticTap } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import type { TechniqueScreenProps } from './types';

/**
 * 4-7-8 Breathing — 4 cycles × (4s inhale + 7s hold + 8s exhale) = 76s.
 *
 * Rendering split:
 *  - The animated circle (scale + opacity) is driven by a
 *    Reanimated shared value; the runtime is happy to sequence
 *    withTiming calls one-by-one on the UI thread.
 *  - The phase label + countdown are React state updated by a
 *    JS-thread interval. Two clocks kept in sync at each transition
 *    by re-issuing the animation from the same handler that sets
 *    the state. In practice they drift by <30ms, which is invisible.
 *
 * Why not `withSequence(withRepeat(...))`: mount-time repeating
 * worklets don't fire reliably in the RN-Web preview (Faz 4 lesson).
 * Manual state machine with a single setTimeout chain reproduces
 * the same effect and works everywhere.
 */

const CYCLES = 4;
const INHALE_MS = 4000;
const HOLD_MS = 7000;
const EXHALE_MS = 8000;

type Phase = 'inhale' | 'hold' | 'exhale';

// Circle scale endpoints. Chosen so the visual is big enough to
// feel embodied but never touches the phase label above.
const SCALE_SMALL = 0.55;
const SCALE_LARGE = 1;

export function Breathing478Screen({
  accentColor,
  onComplete,
}: TechniqueScreenProps) {
  const [cycle, setCycle] = useState(1);
  const [phase, setPhase] = useState<Phase>('inhale');
  // Countdown seconds shown inside the circle. Decrements every
  // 1s within a phase, resets at each phase transition.
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(INHALE_MS / 1000));

  const scale = useSharedValue(SCALE_SMALL);
  const opacity = useSharedValue(0.55);

  // Refs so the sequencer callbacks can inspect the current state
  // without becoming dependencies of the effect.
  const cycleRef = useRef(1);
  const phaseRef = useRef<Phase>('inhale');
  const completedRef = useRef(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    // Fire the initial phase: inhale on cycle 1.
    runPhase('inhale');
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPhase = (nextPhase: Phase) => {
    if (completedRef.current) return;
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    const ms =
      nextPhase === 'inhale'
        ? INHALE_MS
        : nextPhase === 'hold'
          ? HOLD_MS
          : EXHALE_MS;

    // Animation targets. Inhale expands, hold stays large, exhale
    // shrinks. Opacity mirrors — the circle "breathes" light.
    if (nextPhase === 'inhale') {
      scale.value = withTiming(SCALE_LARGE, {
        duration: INHALE_MS,
        easing: Easing.inOut(Easing.quad),
      });
      opacity.value = withTiming(1, { duration: INHALE_MS });
    } else if (nextPhase === 'exhale') {
      scale.value = withTiming(SCALE_SMALL, {
        duration: EXHALE_MS,
        easing: Easing.inOut(Easing.quad),
      });
      opacity.value = withTiming(0.55, { duration: EXHALE_MS });
    }
    // On 'hold' the animation params carry over from inhale — no
    // new withTiming call, so the shared value plateaus.

    // Countdown state — set the initial seconds then tick down.
    const initialSeconds = Math.floor(ms / 1000);
    setSecondsLeft(initialSeconds);
    let elapsedSec = 0;
    for (let s = 1; s <= initialSeconds; s++) {
      const timer = setTimeout(() => {
        setSecondsLeft(Math.max(0, initialSeconds - s));
      }, s * 1000);
      timers.current.push(timer);
      elapsedSec = s;
    }
    void elapsedSec;

    // Transition timer — advances to next phase (or next cycle,
    // or completion).
    const transition = setTimeout(() => {
      // Haptic pulse on phase boundary — subtle, keeps the guide
      // in the user's body.
      hapticTap();
      if (nextPhase === 'inhale') runPhase('hold');
      else if (nextPhase === 'hold') runPhase('exhale');
      else {
        // Just finished an exhale. Either advance to the next
        // cycle or, if we were on the final cycle, complete.
        if (cycleRef.current >= CYCLES) {
          completedRef.current = true;
          onComplete();
          return;
        }
        cycleRef.current += 1;
        setCycle(cycleRef.current);
        runPhase('inhale');
      }
    }, ms);
    timers.current.push(transition);
  };

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case 'inhale':
        return t('breathing.inhale');
      case 'hold':
        return t('breathing.hold');
      case 'exhale':
        return t('breathing.exhale');
    }
  }, [phase]);

  return (
    <View style={styles.root}>
      <Text style={[styles.phaseLabel, { color: accentColor }]}>
        {phaseLabel}
      </Text>

      <View style={styles.circleWrap}>
        <Animated.View
          style={[
            styles.circle,
            {
              borderColor: accentColor,
              backgroundColor: hexAlpha(accentColor, 0.12),
              ...Platform.select({
                web: {
                  boxShadow: `0 0 60px ${hexAlpha(accentColor, 0.3)}`,
                },
                default: {},
              }),
            },
            circleStyle,
          ]}
          pointerEvents="none"
        />
        <Text style={styles.secondsInside}>{secondsLeft}</Text>
      </View>

      <Text style={styles.cycleLabel}>
        {t('breathing.cycle_of', { current: cycle, total: CYCLES })}
      </Text>
    </View>
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  phaseLabel: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  circleWrap: {
    // Fixed 320px slot so the animated scale doesn't push
    // surrounding text around.
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    position: 'absolute',
  },
  secondsInside: {
    color: '#F1F5F9',
    fontSize: 44,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  cycleLabel: {
    color: '#6B8BA4',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1.2,
  },
});
