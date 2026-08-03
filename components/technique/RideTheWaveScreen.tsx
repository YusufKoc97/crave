import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  ClipPath,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { hexAlpha } from '@/constants/designSystem';
import { t } from '@/lib/i18n';
import type { SceneProps } from './types';

/**
 * Ride the Wave — urge surfing, visualized.
 *
 * A craving is drawn as one wave: it rises from baseline, peaks around
 * a third of the way in (the hardest moment), then fades on a long,
 * gradual tail back toward baseline. A marker rides the curve so the
 * user literally sees themselves climb the peak and descend — proof,
 * by the end, that the urge was temporary and passed on its own.
 *
 * The whole curve is visible from the start (the descent is always in
 * view — that is the reassurance), and the portion already travelled
 * lights up behind the marker via an animated clip reveal.
 *
 * No breathing cues here — breathing is a separate toolkit exercise.
 *
 * Contract (see SceneProps): fires `onComplete` once at 240s, reports
 * `onProgress(0..1)` so the shell's focal glow intensifies toward the
 * end, taps `haptics` at the peak and at the closing line, and honours
 * `reducedMotion` (curve + marker + text always run; only the marker's
 * decorative halo pulse is dropped). Cleans up its timer/animation on
 * unmount; the shell restarts it from zero on foreground via a remount.
 */

const DURATION_MS = 240_000; // 4 minutes, single wave
const PEAK_FRAC = 1 / 3; // ~80s in
const END_LEVEL = 0.06; // where the tail settles (near baseline)
const SAMPLES = 56;

const DOT = 18;
const H = 260;
const BASELINE = 210;
const TOP_MARGIN = 46;
const AMP = BASELINE - TOP_MARGIN; // 164
const MARGIN_X = 24;

// Intensity a(f) ∈ [0,1]: 0 = baseline (calm), 1 = peak. Fast smooth
// rise, then a long gradual decay — mirrors a real craving's fast
// onset and slow fade.
function smootherstep(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
}
function intensity(f: number): number {
  if (f <= PEAK_FRAC) return smootherstep(f / PEAK_FRAC);
  const v = (f - PEAK_FRAC) / (1 - PEAK_FRAC);
  return END_LEVEL + (1 - END_LEVEL) * Math.pow(1 - v, 1.5);
}

// Phase-synced awareness lines. `until` is the upper fraction bound.
const PHASES = [
  { key: 'wave_rising', until: 0.27 },
  { key: 'wave_near_peak', until: 0.31 },
  { key: 'wave_peak', until: 0.42 },
  { key: 'wave_early_fade', until: 0.66 },
  { key: 'wave_late_fade', until: 0.9 },
  { key: 'wave_final', until: 1.01 },
] as const;
const PEAK_PHASE = 2; // 'wave_peak' — haptic + glow crest
const FINAL_PHASE = 5; // 'wave_final' — closing haptic

function phaseIndexFor(f: number): number {
  for (let i = 0; i < PHASES.length; i++) if (f < PHASES[i].until) return i;
  return PHASES.length - 1;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function RideTheWaveScreen({
  accentColor,
  onComplete,
  onProgress,
  haptics,
  reducedMotion,
}: SceneProps) {
  const { width: W } = useWindowDimensions();
  const plotW = W - MARGIN_X * 2;

  // Sampled geometry — computed once per width. FRACS/YS also feed the
  // marker's Y interpolation so the dot sits exactly on the drawn line.
  const { lineD, areaD, FRACS, YS } = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    const fr: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const f = i / (SAMPLES - 1);
      fr.push(f);
      xs.push(MARGIN_X + f * plotW);
      ys.push(BASELINE - intensity(f) * AMP);
    }
    let line = `M ${xs[0]} ${ys[0]}`;
    for (let i = 1; i < SAMPLES; i++) line += ` L ${xs[i]} ${ys[i]}`;
    let area = `M ${xs[0]} ${BASELINE} L ${xs[0]} ${ys[0]}`;
    for (let i = 1; i < SAMPLES; i++) area += ` L ${xs[i]} ${ys[i]}`;
    area += ` L ${xs[SAMPLES - 1]} ${BASELINE} Z`;
    return { lineD: line, areaD: area, FRACS: fr, YS: ys };
  }, [plotW]);

  const [phaseIdx, setPhaseIdx] = useState(0);

  // Marker driver: 0→1 over the session. Runs even under reduced
  // motion — the marker travelling IS the exercise, not decoration.
  const tv = useSharedValue(0);
  // Decorative halo pulse around the marker — dropped under reduced
  // motion.
  const halo = useSharedValue(0);

  const phaseRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    tv.value = withTiming(1, { duration: DURATION_MS, easing: Easing.linear });

    const start = performance.now();
    const id = setInterval(() => {
      const f = Math.min(1, (performance.now() - start) / DURATION_MS);
      onProgress?.(f);

      const pi = phaseIndexFor(f);
      if (pi !== phaseRef.current) {
        phaseRef.current = pi;
        setPhaseIdx(pi);
        // Gentle tap at the peak (you made it to the top) and at the
        // closing line (you rode it out).
        if (pi === PEAK_PHASE || pi === FINAL_PHASE) haptics?.tap();
      }

      if (f >= 1 && !completedRef.current) {
        completedRef.current = true;
        clearInterval(id);
        onComplete();
      }
    }, 200);

    return () => {
      clearInterval(id);
      cancelAnimation(tv);
    };
    // Mount-once: props are stable for a given launch; the shell remounts
    // this component (fresh key) to restart, so we never re-run here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      halo.value = 0;
      return;
    }
    halo.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(halo);
  }, [reducedMotion, halo]);

  // Clip that reveals the "already travelled" bright curve up to the
  // marker's X — grows on the UI thread, no per-frame path rebuild.
  const revealProps = useAnimatedProps(() => ({
    width: MARGIN_X + tv.value * plotW,
  }));

  const markerStyle = useAnimatedStyle(() => {
    const mx = MARGIN_X + tv.value * plotW;
    const my = interpolate(tv.value, FRACS, YS, Extrapolation.CLAMP);
    return {
      transform: [{ translateX: mx - DOT / 2 }, { translateY: my - DOT / 2 }],
    };
  });

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.4 - halo.value * 0.28,
    transform: [{ scale: 0.9 + halo.value * 0.6 }],
  }));

  const line = t(`toolkit.techniques.ride_the_wave.${PHASES[phaseIdx].key}`);

  return (
    <View style={styles.root}>
      <View style={styles.textZone}>
        <Animated.Text
          key={phaseIdx}
          entering={reducedMotion ? undefined : FadeIn.duration(600)}
          style={styles.awareness}
        >
          {line}
        </Animated.Text>
      </View>

      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <LinearGradient id="rtwDim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accentColor} stopOpacity={0.16} />
              <Stop offset="1" stopColor={accentColor} stopOpacity={0.02} />
            </LinearGradient>
            <LinearGradient id="rtwBright" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accentColor} stopOpacity={0.5} />
              <Stop offset="1" stopColor={accentColor} stopOpacity={0.06} />
            </LinearGradient>
            <ClipPath id="rtwReveal">
              <AnimatedRect
                x={0}
                y={0}
                height={H}
                animatedProps={revealProps}
              />
            </ClipPath>
          </Defs>

          {/* Baseline hairline — the "calm" the wave returns to. */}
          <Path
            d={`M ${MARGIN_X} ${BASELINE} L ${W - MARGIN_X} ${BASELINE}`}
            stroke={hexAlpha('#8aa0c0', 0.25)}
            strokeWidth={1}
          />

          {/* Whole wave, dim — the descent is always in view. */}
          <Path d={areaD} fill="url(#rtwDim)" />
          <Path
            d={lineD}
            stroke={accentColor}
            strokeOpacity={0.35}
            strokeWidth={2}
            fill="none"
          />

          {/* Travelled portion, bright — revealed up to the marker. */}
          <G clipPath="url(#rtwReveal)">
            <Path d={areaD} fill="url(#rtwBright)" />
            <Path
              d={lineD}
              stroke={accentColor}
              strokeOpacity={0.95}
              strokeWidth={3}
              fill="none"
            />
          </G>
        </Svg>

        {/* Marker — "you are here" on the curve. */}
        <Animated.View
          style={[styles.marker, markerStyle]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.halo,
              { backgroundColor: hexAlpha(accentColor, 0.5) },
              haloStyle,
            ]}
          />
          <View
            style={[
              styles.dot,
              {
                borderColor: accentColor,
                ...Platform.select({
                  web: { boxShadow: `0 0 12px ${hexAlpha(accentColor, 0.85)}` },
                  default: {
                    shadowColor: accentColor,
                    shadowOpacity: 0.9,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                  },
                }),
              },
            ]}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textZone: {
    paddingHorizontal: 36,
    marginBottom: 40,
    minHeight: 96,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  awareness: {
    color: '#eaf2ff',
    fontSize: 23,
    fontWeight: '500',
    lineHeight: 32,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  marker: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DOT,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: DOT * 2.2,
    height: DOT * 2.2,
    borderRadius: DOT * 1.1,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    backgroundColor: '#f4f8ff',
  },
});
