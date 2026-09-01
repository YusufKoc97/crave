import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { t } from '@/lib/i18n';
import { dsColors } from '@/constants/designSystem';

/**
 * Faz 5 — post-outcome intensity rating. Fires immediately after
 * "I Resisted" is tapped, BEFORE the celebration banner / rank
 * unlock modal. Confirming a value (or Skip) closes the modal and
 * hands the number (or null) back so `finish()` can pass it into
 * the resolve-craving invoke.
 *
 * Craving-capture redesign: the 5-emoji grid is replaced by a 1–10
 * dial driven by a drag track. The reading sits in a ring whose arc
 * burns clockwise from 12 o'clock and whose colour walks from the
 * design system's blue at 1 to its danger red at 10 — cold when it
 * was easy, hot when it hurt.
 *
 * Two deliberate departures from the handoff, both to keep this
 * sheet inside the app's own tone rather than introducing a
 * brighter one:
 *   - Glow alphas are pulled back by roughly a third. The handoff's
 *     stacked `0 0 16px` halos read as a different product next to
 *     the toned-down active-session screen this opens on top of.
 *   - The readout is 52px, not 58. The app's largest numeral is the
 *     46pt Profile hero, so 52 keeps this the biggest thing on
 *     screen without leaving the family.
 *
 * The handoff's grid had no confirm step because tapping an emoji
 * WAS the commit. A drag control has no such moment, so an explicit
 * confirm button was added — without it there is no way to submit a
 * value at all. Skip stays a first-class exit and the backdrop is
 * still inert (karar #5).
 */

type Props = {
  visible: boolean;
  accentColor: string;
  onSelect: (intensity: number | null) => void;
  /** iOS-only — fires once the modal has finished dismissing. The
   *  caller uses it to chain the next modal (the trigger picker)
   *  without racing this one's dismiss animation. */
  onDismiss?: () => void;
};

const DIAL = 186;
const CENTER = DIAL / 2;
/** Annulus 77→84px from the handoff, expressed as one stroked circle. */
const RING_R = 80.5;
const RING_W = 7;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;
const TIP_R = 3.5;

const TRACK_H = 32;
const HANDLE_W = 26;
const HANDLE_H = 14;

/**
 * The OKLab-interpolated ramp, precomputed — OKLab mixing isn't
 * available at runtime. Interpolating between neighbours in sRGB is
 * close enough that a drag still reads as continuous. Violet through
 * the middle, red only in the last two steps.
 */
const LEVEL_COLORS = [
  '#4DABFF', // 1  — dsColors.accentBlue
  '#6095FC',
  '#6D7FF8',
  '#7567F4',
  '#7A4BEF', // 5  — ~theme colors.purple
  '#8848E1',
  '#A459C8',
  '#C164AE',
  '#DF6A90',
  '#FF6B6B', // 10 — dsColors.dangerGlow
] as const;

const MIN_LEVEL = 1;
const MAX_LEVEL = 10;
const START_LEVEL = 5;

/** Shared-value domain for interpolateColor — one stop per level. */
const COLOR_STOPS = LEVEL_COLORS.map((_, i) => i + 1);

/** 1–2 Mild · 3–4 Noticeable · 5–6 Strong · 7–8 Very strong · 9–10 Unbearable. */
function bandKeyFor(level: number) {
  if (level <= 2) return 'craving_flow.intensity.mild';
  if (level <= 4) return 'craving_flow.intensity.noticeable';
  if (level <= 6) return 'craving_flow.intensity.strong';
  if (level <= 8) return 'craving_flow.intensity.very_strong';
  return 'craving_flow.intensity.unbearable';
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function IntensityModal({ visible, onSelect, onDismiss }: Props) {
  const [level, setLevel] = useState(START_LEVEL);
  const [trackW, setTrackW] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  // `level` is the committed integer; `anim` chases it so colour,
  // arc length and handle position glide over 180ms rather than
  // snapping between stops.
  const anim = useSharedValue(START_LEVEL);
  const drift = useSharedValue(0);

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
      cancelAnimation(anim);
      anim.value = level;
      return;
    }
    anim.value = withTiming(level, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  }, [level, anim, reducedMotion]);

  // The ambient wash drifts on its own loop regardless of value —
  // it is what keeps the dial alive while the user is deciding.
  useEffect(() => {
    if (!visible || reducedMotion) {
      cancelAnimation(drift);
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(drift);
  }, [visible, reducedMotion, drift]);

  // Reset to the midpoint on each open so one craving's answer never
  // pre-loads the next one.
  useEffect(() => {
    if (visible) {
      setLevel(START_LEVEL);
      anim.value = START_LEVEL;
    }
  }, [visible, anim]);

  const color = LEVEL_COLORS[level - 1];

  const setFromX = useCallback((x: number, width: number) => {
    if (width <= 0) return;
    const pct = Math.max(0, Math.min(1, x / width));
    const next = Math.min(
      MAX_LEVEL,
      Math.max(MIN_LEVEL, Math.ceil(pct * MAX_LEVEL) || MIN_LEVEL)
    );
    setLevel(next);
  }, []);

  // Width is read through a ref because PanResponder closes over its
  // handlers once — a state value captured at creation time would
  // stay at the first measured width forever.
  const trackWRef = useRef(0);
  trackWRef.current = trackW;
  const setFromXRef = useRef(setFromX);
  setFromXRef.current = setFromX;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Tap-to-set: the value lands where the finger touches down,
      // then tracking follows it.
      onPanResponderGrant: (e) =>
        setFromXRef.current(e.nativeEvent.locationX, trackWRef.current),
      onPanResponderMove: (e) =>
        setFromXRef.current(e.nativeEvent.locationX, trackWRef.current),
    })
  ).current;

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - anim.value / MAX_LEVEL),
    stroke: interpolateColor(anim.value, COLOR_STOPS, LEVEL_COLORS),
  }));

  const tipProps = useAnimatedProps(() => {
    const rad = ((-90 + (anim.value / MAX_LEVEL) * 360) * Math.PI) / 180;
    return {
      cx: CENTER + RING_R * Math.cos(rad),
      cy: CENTER + RING_R * Math.sin(rad),
    };
  });

  const rimProps = useAnimatedProps(() => ({
    stroke: interpolateColor(anim.value, COLOR_STOPS, LEVEL_COLORS),
    strokeOpacity: 0.12 + (anim.value / MAX_LEVEL) * 0.18,
  }));

  const washStyle = useAnimatedStyle(() => ({
    // Intensity rides the value; the drift only breathes on top of it.
    opacity:
      (0.1 + (anim.value / MAX_LEVEL) * 0.3) * (0.82 + drift.value * 0.18),
    transform: [{ scale: 0.94 + drift.value * 0.12 }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${(anim.value / MAX_LEVEL) * 100}%`,
    backgroundColor: interpolateColor(anim.value, COLOR_STOPS, LEVEL_COLORS),
  }));

  const handleStyle = useAnimatedStyle(() => {
    const pct = anim.value / MAX_LEVEL;
    return {
      // Offset by the handle's own width so it never overhangs
      // either end of the track.
      transform: [{ translateX: pct * trackW - pct * HANDLE_W }],
      borderColor: interpolateColor(anim.value, COLOR_STOPS, LEVEL_COLORS),
    };
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onSelect(null)}
      onDismiss={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {t('craving_flow.intensity_question')}
          </Text>
          <Text style={styles.subtitle}>
            {t('craving_flow.intensity_subtitle')}
          </Text>

          <View style={styles.dial}>
            <Animated.View
              style={[styles.wash, washStyle]}
              pointerEvents="none"
            >
              <Svg width={DIAL} height={DIAL}>
                <Defs>
                  <RadialGradient id="intensityWash" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={color} stopOpacity={0.55} />
                    <Stop offset="70%" stopColor={color} stopOpacity={0.12} />
                    <Stop offset="100%" stopColor={color} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle
                  cx={CENTER}
                  cy={CENTER}
                  r={CENTER - 12}
                  fill="url(#intensityWash)"
                />
              </Svg>
            </Animated.View>

            <Svg width={DIAL} height={DIAL} style={StyleSheet.absoluteFill}>
              {/* Ring track */}
              <Circle
                cx={CENTER}
                cy={CENTER}
                r={RING_R}
                stroke="#101B30"
                strokeWidth={RING_W}
                fill="none"
              />
              {/* Inner rim — picks up the value colour faintly */}
              <AnimatedCircle
                cx={CENTER}
                cy={CENTER}
                r={RING_R - 12}
                strokeWidth={1}
                fill="none"
                animatedProps={rimProps}
              />
              {/* Value arc, clockwise from 12 o'clock */}
              <AnimatedCircle
                cx={CENTER}
                cy={CENTER}
                r={RING_R}
                strokeWidth={RING_W}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                animatedProps={arcProps}
              />
              {/* Anchor pip at 12 o'clock — marks zero, stays dim */}
              <Circle cx={CENTER} cy={CENTER - RING_R} r={2.5} fill="#2B3E6E" />
              {/* Lit tip riding the end of the arc */}
              <AnimatedCircle
                r={TIP_R}
                fill="#F1F5F9"
                animatedProps={tipProps}
              />
            </Svg>

            <View style={styles.readout} pointerEvents="none">
              <Text style={[styles.numeral, { textShadowColor: `${color}66` }]}>
                {level}
              </Text>
              <Text style={styles.band}>{t(bandKeyFor(level))}</Text>
            </View>
          </View>

          <View
            style={styles.track}
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
            accessibilityRole="adjustable"
            accessibilityLabel={t('craving_flow.intensity_question')}
            accessibilityValue={{ min: MIN_LEVEL, max: MAX_LEVEL, now: level }}
            {...pan.panHandlers}
          >
            <View style={styles.trackLine} />
            <Animated.View style={[styles.trackFill, fillStyle]} />
            <View style={styles.ticks} pointerEvents="none">
              {Array.from({ length: MAX_LEVEL }, (_, i) => {
                const stop = i + 1;
                const major = stop === 5 || stop === MAX_LEVEL;
                return (
                  <View key={stop} style={styles.tickCell}>
                    <View
                      style={[
                        styles.tick,
                        major && styles.tickMajor,
                        {
                          backgroundColor:
                            stop <= level ? `${color}8C` : '#1F2E52',
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
            <Animated.View
              style={[styles.handle, handleStyle]}
              pointerEvents="none"
            >
              <View style={[styles.grip, { backgroundColor: `${color}B3` }]} />
            </Animated.View>
          </View>

          <View style={styles.endpoints}>
            <Text style={styles.endpointText}>
              {t('craving_flow.intensity_min')}
            </Text>
            <Text style={styles.endpointText}>
              {t('craving_flow.intensity_max')}
            </Text>
          </View>

          <Pressable
            onPress={() => onSelect(level)}
            style={({ pressed }) => [
              styles.confirmBtn,
              {
                backgroundColor: `${color}24`,
                borderColor: `${color}73`,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('craving_flow.intensity_confirm')}
          >
            <Text style={[styles.confirmText, { color }]}>
              {t('craving_flow.intensity_confirm')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onSelect(null)}
            style={styles.skipBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('craving_flow.intensity_skip')}
          >
            <Text style={styles.skipText}>
              {t('craving_flow.intensity_skip')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 342,
    backgroundColor: '#0A1628',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    boxShadow:
      '0 20px 60px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  title: {
    color: '#F1F5F9',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 7,
    color: dsColors.textSecondary,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  dial: {
    marginTop: 24,
    width: DIAL,
    height: DIAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readout: {
    alignItems: 'center',
  },
  numeral: {
    color: '#F1F5F9',
    fontSize: 52,
    fontWeight: '200',
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  band: {
    marginTop: 4,
    color: dsColors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  track: {
    marginTop: 24,
    width: '100%',
    height: TRACK_H,
    justifyContent: 'center',
  },
  trackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#101B30',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  ticks: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickCell: {
    flex: 1,
    alignItems: 'flex-end',
  },
  tick: {
    width: 1,
    height: 8,
  },
  tickMajor: {
    height: 12,
  },
  handle: {
    position: 'absolute',
    left: 0,
    width: HANDLE_W,
    height: HANDLE_H,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#0F1C31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: {
    width: 10,
    height: 1,
  },
  endpoints: {
    marginTop: 4,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  endpointText: {
    color: dsColors.textSecondary,
    fontSize: 10,
    fontWeight: '500',
  },
  confirmBtn: {
    marginTop: 18,
    width: '100%',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  skipBtn: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  skipText: {
    color: '#7BA8C8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
});
