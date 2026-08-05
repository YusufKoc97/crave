import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
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
  useFrameCallback,
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
 * A craving is drawn as one wave: it rises from baseline, peaks (the
 * hardest moment), then fades on a long tail back toward baseline. A
 * marker rides the curve so the user literally sees themselves climb
 * the peak and descend — proof, by the end, that the urge was
 * temporary and passed on its own.
 *
 * Depth by horizon: everything ABOVE the wave's surface line is sky
 * (the shell's ExerciseAtmosphere — stars, nebula, glow); everything
 * BELOW it is water — a semi-opaque body with its own gradient, an
 * under-crest bloom, and slow drifting light. Because the water body
 * occludes the atmosphere behind it, the two layers stop bleeding into
 * each other (no muddy overlap) and the scene reads as sky-over-water
 * with real depth instead of a flat curve on a glow.
 *
 * TEMPO is the point (not constant speed): the marker rises FAST,
 * slows across the crest (you sit in the hardest moment — slowed, never
 * frozen), then fades SLOWLY on the long tail. The geometry of the
 * curve is fixed (peak at ~1/3 of the width); only the *distribution of
 * time across it* is warped — see TAU/TV below.
 *
 * No breathing cues here — breathing is a separate toolkit exercise.
 *
 * Contract (see SceneProps): fires `onComplete` once at 240s of
 * *foreground* time, reports `onProgress(0..1)` (the wave's intensity,
 * so the shell's glow blooms toward the peak), taps `haptics` at the
 * peak and the closing line, honours `reducedMotion` (curve + marker +
 * warped speed + text + the marker's intensity glow always run; only
 * the ambient drift/pulse loops are dropped). The timeline is driven by
 * a frame callback, so it pauses when the app backgrounds and resumes
 * exactly where it left off. See `foregroundGraceMs` on the registry.
 */

const DURATION_MS = 240_000; // 4 minutes of foreground time, single wave
const PEAK_FRAC = 1 / 3; // peak at 1/3 of the curve width
const END_LEVEL = 0.03; // where the tail settles (near baseline)
const SAMPLES = 96; // dense enough that the smoothed curve reads clean

const DOT = 18;
const HALO = 66; // soft radial glow box around the marker
const H = 260;
const BASELINE = 210;
const TOP_MARGIN = 46;
const AMP = BASELINE - TOP_MARGIN; // 164
const MARGIN_X = 24;

// Time-warp: raw time τ (0..1) → curve position tv (0..1). Fast rise,
// a real slow-down across the crest (but always moving — the old
// near-hold read as a freeze), then a long steady fade. Piecewise
// linear over these keyframes; the slowest segment (the crest linger)
// is ~3.4× slower than the rise, not a stop.
//   τ 0.00–0.14 → tv 0 → 0.30    fast climb to the crest (~34s)
//   τ 0.14–0.30 → tv 0.30 → 0.40 the crest linger — slow, still drifting
//   τ 0.30–0.55 → tv 0.40 → 0.60 gentle early fade
//   τ 0.55–1.00 → tv 0.60 → 1.0  the long slow fade
const TAU = [0, 0.14, 0.3, 0.55, 1] as const;
const TV = [0, 0.3, 0.4, 0.6, 1] as const;

// JS mirror of the worklet interpolate(raw, TAU, TV) so the phase /
// haptic / progress logic reads the same curve position as the marker.
function warp(tau: number): number {
  const c = Math.max(0, Math.min(1, tau));
  for (let i = 1; i < TAU.length; i++) {
    if (c <= TAU[i]) {
      const s = (c - TAU[i - 1]) / (TAU[i] - TAU[i - 1]);
      return TV[i - 1] + s * (TV[i] - TV[i - 1]);
    }
  }
  return 1;
}

// Intensity a(f) ∈ [0,1]: 0 = baseline (calm), 1 = peak. Fast smooth
// rise, then a long gradual decay.
function smootherstep(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
}
function intensity(f: number): number {
  if (f <= PEAK_FRAC) return smootherstep(f / PEAK_FRAC);
  const v = (f - PEAK_FRAC) / (1 - PEAK_FRAC);
  return END_LEVEL + (1 - END_LEVEL) * Math.pow(1 - v, 1.5);
}

// Phase-synced awareness lines, keyed on curve position tv (so they
// track the marker, not raw time — the 'peak' line lingers through the
// slowed crest). `until` is the upper tv bound.
const PHASES = [
  { key: 'wave_rising', until: 0.27 },
  { key: 'wave_near_peak', until: 0.31 },
  { key: 'wave_peak', until: 0.42 },
  { key: 'wave_early_fade', until: 0.66 },
  { key: 'wave_late_fade', until: 0.9 },
  { key: 'wave_final', until: 1.01 },
] as const;
const PEAK_PHASE = 2; // 'wave_peak' — haptic
const FINAL_PHASE = 5; // 'wave_final' — closing haptic

function phaseIndexFor(tv: number): number {
  for (let i = 0; i < PHASES.length; i++) if (tv < PHASES[i].until) return i;
  return PHASES.length - 1;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export function RideTheWaveScreen({
  accentColor,
  addictionId,
  onComplete,
  onProgress,
  haptics,
  reducedMotion,
}: SceneProps) {
  const { width: W } = useWindowDimensions();
  const plotW = W - MARGIN_X * 2;

  // Sampled geometry — computed once per width. FRACS/YS feed the
  // marker's Y interpolation so the dot sits exactly on the drawn line.
  // crestX/crestY position the under-crest bloom.
  const { lineD, areaD, FRACS, YS, INTENS, crestX, crestY } = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    const fr: number[] = [];
    const ia: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const f = i / (SAMPLES - 1);
      const a = intensity(f);
      fr.push(f);
      ia.push(a);
      xs.push(MARGIN_X + f * plotW);
      ys.push(BASELINE - a * AMP);
    }
    // Catmull-Rom → cubic bézier through every sample, so the crest and
    // the tail read as polished water rather than faceted line segments.
    let segs = '';
    for (let i = 0; i < SAMPLES - 1; i++) {
      const x0 = xs[i - 1] ?? xs[i];
      const y0 = ys[i - 1] ?? ys[i];
      const x1 = xs[i];
      const y1 = ys[i];
      const x2 = xs[i + 1];
      const y2 = ys[i + 1];
      const x3 = xs[i + 2] ?? x2;
      const y3 = ys[i + 2] ?? y2;
      const c1x = x1 + (x2 - x0) / 6;
      const c1y = y1 + (y2 - y0) / 6;
      const c2x = x2 - (x3 - x1) / 6;
      const c2y = y2 - (y3 - y1) / 6;
      segs += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
    }
    const line = `M ${xs[0]} ${ys[0]}${segs}`;
    const area =
      `M ${xs[0]} ${BASELINE} L ${xs[0]} ${ys[0]}${segs}` +
      ` L ${xs[SAMPLES - 1]} ${BASELINE} Z`;
    return {
      lineD: line,
      areaD: area,
      FRACS: fr,
      YS: ys,
      INTENS: ia,
      crestX: MARGIN_X + PEAK_FRAC * plotW,
      crestY: BASELINE - 0.72 * AMP,
    };
  }, [plotW]);

  const [phaseIdx, setPhaseIdx] = useState(0);

  // Raw time base 0→1. Advanced by a frame callback so it accrues only
  // FOREGROUND frames — backgrounding pauses it, foreground resumes it
  // exactly where it stopped. tv (curve position) is warped from this.
  const raw = useSharedValue(0);

  // Ambient loops (calm tide): two soft light bodies drift over the
  // water at different depths/speeds (parallax = "living water"); a
  // slow surface breath brightens the crest rim. All dropped under
  // reduced motion.
  const drift1 = useSharedValue(0);
  const drift2 = useSharedValue(0);
  const breath = useSharedValue(0);

  const phaseRef = useRef(0);
  const completedRef = useRef(false);

  useFrameCallback((frame) => {
    'worklet';
    if (raw.value >= 1) return;
    const dt = frame.timeSincePreviousFrame ?? 16;
    raw.value = Math.min(1, raw.value + dt / DURATION_MS);
  });

  // JS side — reads the (foreground-only) raw value each tick and syncs
  // the awareness line, haptics, progress report and completion to the
  // marker's curve position.
  useEffect(() => {
    const id = setInterval(() => {
      const tau = raw.value;
      const tv = warp(tau);
      // Report the wave's *intensity* (not raw time) so the shell's
      // atmosphere blooms toward the peak and releases on the fade —
      // peaks at tv≈1/3, settles near baseline by the end.
      onProgress?.(intensity(tv));

      const pi = phaseIndexFor(tv);
      if (pi !== phaseRef.current) {
        phaseRef.current = pi;
        setPhaseIdx(pi);
        if (pi === PEAK_PHASE || pi === FINAL_PHASE) haptics?.tap();
      }

      if (tau >= 1 && !completedRef.current) {
        completedRef.current = true;
        clearInterval(id);
        onComplete();
      }
    }, 150);
    return () => clearInterval(id);
    // Mount-once; props are stable for a given launch and the shell
    // remounts (fresh key) to restart after a long absence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      drift1.value = 0;
      drift2.value = 0;
      breath.value = 0;
      return;
    }
    drift1.value = withRepeat(
      withTiming(1, { duration: 8200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    drift2.value = withRepeat(
      withTiming(1, { duration: 11600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    breath.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(drift1);
      cancelAnimation(drift2);
      cancelAnimation(breath);
    };
  }, [reducedMotion, drift1, drift2, breath]);

  // Reveal the bright travelled water up to the marker's warped X.
  const revealProps = useAnimatedProps(() => {
    const tv = interpolate(raw.value, TAU, TV, Extrapolation.CLAMP);
    return { width: MARGIN_X + tv * plotW };
  });

  // Two drifting light bodies over the water (clipped to the area),
  // moving in opposite directions at different speeds = parallax.
  const GLOW_W = W * 0.66;
  const drift1Props = useAnimatedProps(() => ({
    x: -GLOW_W * 0.5 + drift1.value * (W - GLOW_W * 0.2),
  }));
  const drift2Props = useAnimatedProps(() => ({
    x: W - GLOW_W * 0.8 - drift2.value * (W - GLOW_W * 0.2),
  }));

  // Gentle surface breath on the crest rim highlight.
  const rimProps = useAnimatedProps(() => ({
    strokeOpacity: 0.5 + breath.value * 0.28,
  }));

  const markerStyle = useAnimatedStyle(() => {
    const tv = interpolate(raw.value, TAU, TV, Extrapolation.CLAMP);
    const mx = MARGIN_X + tv * plotW;
    const my = interpolate(tv, FRACS, YS, Extrapolation.CLAMP);
    return {
      transform: [{ translateX: mx - DOT / 2 }, { translateY: my - DOT / 2 }],
    };
  });

  // Marker glow (accent) — a soft radial that swells with the wave's
  // intensity at the marker (iv) and pulses gently with the breath.
  // Emotional signal, so the intensity swell keeps running under reduced
  // motion; only the breath pulse is gated (breath stays 0).
  const haloStyle = useAnimatedStyle(() => {
    const tv = interpolate(raw.value, TAU, TV, Extrapolation.CLAMP);
    const iv = interpolate(tv, FRACS, INTENS, Extrapolation.CLAMP);
    return {
      // White base glow — gentle and roughly constant; the size grows
      // with intensity, but the *colour* of the peak comes from the red
      // overlay below, so this stays low and lets red dominate up top.
      opacity: 0.34 + breath.value * 0.1,
      transform: [{ scale: 0.72 + iv * 0.5 + breath.value * 0.08 }],
    };
  });

  // Red charge overlay — the crest is the critical moment: the glow
  // reddens as the marker climbs, is deepest red at the very top, then
  // fades back out so the white base returns on the descent. Emotional
  // signal (not decoration), so it tracks intensity even under reduced
  // motion.
  const haloRedStyle = useAnimatedStyle(() => {
    const tv = interpolate(raw.value, TAU, TV, Extrapolation.CLAMP);
    const iv = interpolate(tv, FRACS, INTENS, Extrapolation.CLAMP);
    return {
      opacity: iv * 0.95,
      transform: [{ scale: 0.8 + iv * 0.5 }],
    };
  });

  // Awareness copy is tuned per urge: prefer the addiction's own line,
  // fall back to the shared wording when it has none. `t()` echoes the
  // key back when it's missing, which is what the equality check
  // detects — so a typo/absent override degrades to the generic line
  // instead of printing a raw key on screen.
  const line = useMemo(() => {
    const phase = PHASES[phaseIdx].key;
    const generic = `toolkit.techniques.ride_the_wave.${phase}`;
    if (addictionId) {
      const scoped = `toolkit.techniques.ride_the_wave.by_addiction.${addictionId}.${phase}`;
      const scopedText = t(scoped);
      if (scopedText !== scoped) return scopedText;
    }
    return t(generic);
  }, [phaseIdx, addictionId]);

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
            {/* Water body: accent-tinted surface fading into a deep
                navy floor. The opaque floor is what occludes the sky
                glow behind, giving the horizon separation. */}
            <LinearGradient id="rtwWater" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accentColor} stopOpacity={0.5} />
              <Stop offset="0.4" stopColor={accentColor} stopOpacity={0.34} />
              <Stop offset="1" stopColor="#0a1524" stopOpacity={0.94} />
            </LinearGradient>
            {/* Luminous depth under the crest. */}
            <RadialGradient id="rtwBloom" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={accentColor} stopOpacity={0.42} />
              <Stop offset="0.6" stopColor={accentColor} stopOpacity={0.12} />
              <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
            </RadialGradient>
            {/* Soft drifting light on the surface. */}
            <RadialGradient id="rtwGlow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#eaf2ff" stopOpacity={0.22} />
              <Stop offset="0.6" stopColor="#eaf2ff" stopOpacity={0.08} />
              <Stop offset="1" stopColor="#eaf2ff" stopOpacity={0} />
            </RadialGradient>
            <ClipPath id="rtwReveal">
              <AnimatedRect
                x={0}
                y={0}
                height={H}
                animatedProps={revealProps}
              />
            </ClipPath>
            <ClipPath id="rtwArea">
              <Path d={areaD} />
            </ClipPath>
          </Defs>

          {/* Baseline hairline — the "calm" the wave returns to. */}
          <Path
            d={`M ${MARGIN_X} ${BASELINE} L ${W - MARGIN_X} ${BASELINE}`}
            stroke={hexAlpha('#8aa0c0', 0.22)}
            strokeWidth={1}
          />

          {/* Water body — the whole wave, always in view (the descent
              is the reassurance). Occludes the sky behind it. */}
          <Path d={areaD} fill="url(#rtwWater)" />

          {/* Everything that lives inside the water, clipped to it. */}
          <G clipPath="url(#rtwArea)">
            {/* Under-crest luminous bloom. */}
            <Ellipse
              cx={crestX}
              cy={crestY}
              rx={plotW * 0.26}
              ry={72}
              fill="url(#rtwBloom)"
            />
            {/* Drifting surface light — the calm-tide motion. */}
            {!reducedMotion ? (
              <>
                <AnimatedRect
                  y={BASELINE - AMP * 0.9}
                  width={GLOW_W}
                  height={150}
                  fill="url(#rtwGlow)"
                  animatedProps={drift1Props}
                />
                <AnimatedRect
                  y={BASELINE - AMP * 0.5}
                  width={GLOW_W}
                  height={120}
                  fill="url(#rtwGlow)"
                  animatedProps={drift2Props}
                />
              </>
            ) : null}
          </G>

          {/* Dim surface line over the untravelled water. */}
          <Path
            d={lineD}
            stroke={accentColor}
            strokeOpacity={0.32}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Travelled portion — brighter water + a glowing rim that
              breathes. Revealed up to the marker. */}
          <G clipPath="url(#rtwReveal)">
            {/* wide soft under-stroke = trail glow */}
            <Path
              d={lineD}
              stroke={accentColor}
              strokeOpacity={0.16}
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* bright surface rim, breathing */}
            <AnimatedPath
              d={lineD}
              stroke="#eaf2ff"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              animatedProps={rimProps}
            />
          </G>
        </Svg>

        {/* Marker — "you are here" on the curve. */}
        <Animated.View
          style={[styles.marker, markerStyle]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.haloBox, haloStyle]}>
            <Svg width={HALO} height={HALO}>
              <Defs>
                <RadialGradient id="rtwHalo" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0" stopColor="#eef4ff" stopOpacity={0.62} />
                  <Stop offset="0.45" stopColor="#eef4ff" stopOpacity={0.22} />
                  <Stop offset="1" stopColor="#eef4ff" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle
                cx={HALO / 2}
                cy={HALO / 2}
                r={HALO / 2}
                fill="url(#rtwHalo)"
              />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.haloBox, haloRedStyle]}>
            <Svg width={HALO} height={HALO}>
              <Defs>
                <RadialGradient id="rtwHaloRed" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0" stopColor="#f5322a" stopOpacity={0.85} />
                  <Stop offset="0.5" stopColor="#b01414" stopOpacity={0.42} />
                  <Stop offset="1" stopColor="#7a0d0d" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle
                cx={HALO / 2}
                cy={HALO / 2}
                r={HALO / 2}
                fill="url(#rtwHaloRed)"
              />
            </Svg>
          </Animated.View>
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
  haloBox: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    backgroundColor: '#f4f8ff',
  },
});
