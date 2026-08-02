import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { hexAlpha } from '@/constants/designSystem';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';

/**
 * ExerciseAtmosphere — the fresh atmospheric shell behind every
 * exercise scene (Toolkit foundation, Part B / Direction 2).
 *
 * The runner used to sit on a flat `#020810`; that read shallower than
 * the rest of the app. This lays the family's language underneath the
 * scene:
 *   - a layered navy base (never a single solid fill),
 *   - a large per-addiction accent nebula blooming from the upper
 *     third, plus a cooler counter-bloom low for balance,
 *   - a sparse constellation of stars echoing Journey's PATH scene,
 *   - a faint horizon arc grounding the composition,
 *   - a central focal glow that *breathes* ambiently and, when a scene
 *     reports it, intensifies with `progress` toward completion.
 *
 * Everything is programmatic (SVG + Reanimated) — no images, no blur
 * library. Two slow loops only (nebula + focal breath), so the GPU
 * cost stays flat. Under reduced motion every loop freezes at its
 * resting frame.
 *
 * The accent drives all colour, so the shell recolours itself per
 * addiction (Nicotine grey, Caffeine warm, Doomscrolling blue, …)
 * without any per-addiction code.
 */

// Fixed constellation — deterministic so the field doesn't reshuffle
// on every render. Coordinates are viewBox fractions (0..1) over the
// top ~62% of the screen, radii in viewBox units, `tw` marks the few
// that twinkle. Kept sparse (restraint over clutter).
const STARS: { x: number; y: number; r: number; tw?: boolean }[] = [
  { x: 0.12, y: 0.1, r: 1.3 },
  { x: 0.24, y: 0.19, r: 1.0, tw: true },
  { x: 0.38, y: 0.08, r: 1.5 },
  { x: 0.52, y: 0.16, r: 1.0 },
  { x: 0.67, y: 0.09, r: 1.2, tw: true },
  { x: 0.8, y: 0.2, r: 1.4 },
  { x: 0.9, y: 0.12, r: 1.0 },
  { x: 0.16, y: 0.34, r: 1.1 },
  { x: 0.31, y: 0.42, r: 1.3, tw: true },
  { x: 0.72, y: 0.38, r: 1.1 },
  { x: 0.86, y: 0.46, r: 1.2 },
  { x: 0.6, y: 0.5, r: 1.0 },
];

const VB_W = 400;
const VB_H = 800;

export function ExerciseAtmosphere({
  accentColor,
  progress,
}: {
  accentColor: string;
  /** 0..1 guided-phase progress. Optional — when a scene owns its own
   *  timer and never reports, the focal glow simply breathes at its
   *  ambient baseline, which is a complete look on its own. */
  progress?: SharedValue<number>;
}) {
  const reduced = useReducedMotion();

  // Two ambient loops. `breath` drives the nebula + focal scale/opacity
  // swell; `twinkle` fades the marked stars. Both freeze under reduced
  // motion (held at their resting value).
  const breath = useSharedValue(0);
  const twinkle = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      breath.value = 0;
      twinkle.value = 1;
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    twinkle.value = withRepeat(
      withTiming(0.35, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [reduced, breath, twinkle]);

  // Nebula: gentle scale + opacity swell.
  const nebulaStyle = useAnimatedStyle(() => {
    const s = 1 + breath.value * 0.06;
    return {
      opacity: 0.85 + breath.value * 0.15,
      transform: [{ scale: s }],
    };
  });

  // Focal glow: ambient breath, lifted by reported progress. With no
  // progress reported it reads as a soft, living centre; as a scene
  // nears completion it brightens and grows.
  const focalStyle = useAnimatedStyle(() => {
    const p = progress?.value ?? 0;
    const base = 0.4 + breath.value * 0.12;
    return {
      opacity: base + p * 0.4,
      transform: [{ scale: 0.9 + breath.value * 0.06 + p * 0.35 }],
    };
  });

  const twinkleStyle = useAnimatedStyle(() => ({ opacity: twinkle.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Static base: navy gradient + accent nebula + counter-bloom +
          horizon arc + the non-twinkling stars. One SVG, no per-frame
          cost. */}
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="exBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#070d1a" />
            <Stop offset="0.55" stopColor="#040914" />
            <Stop offset="1" stopColor="#02060e" />
          </LinearGradient>
          <RadialGradient id="exCounter" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={accentColor} stopOpacity={0.14} />
            <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="exHorizon" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={accentColor} stopOpacity={0.1} />
            <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#exBase)" />

        {/* Counter-bloom low-left — depth balance for the top nebula. */}
        <Ellipse
          cx={VB_W * 0.2}
          cy={VB_H * 0.82}
          rx={VB_W * 0.55}
          ry={VB_H * 0.3}
          fill="url(#exCounter)"
        />

        {/* Horizon arc — a wide, very soft bloom hugging the bottom. */}
        <Ellipse
          cx={VB_W * 0.5}
          cy={VB_H * 1.02}
          rx={VB_W * 0.85}
          ry={VB_H * 0.22}
          fill="url(#exHorizon)"
        />

        {/* Static stars. */}
        {STARS.filter((s) => !s.tw).map((s, i) => (
          <Circle
            key={`s${i}`}
            cx={s.x * VB_W}
            cy={s.y * VB_H}
            r={s.r}
            fill={hexAlpha('#dfe9ff', 0.55)}
          />
        ))}
      </Svg>

      {/* Breathing accent nebula, upper-third, off-centre. */}
      <Animated.View style={[styles.nebula, nebulaStyle]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="exNebulaLive" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={accentColor} stopOpacity={0.34} />
              <Stop offset="0.5" stopColor={accentColor} stopOpacity={0.1} />
              <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
            fill="url(#exNebulaLive)"
          />
        </Svg>
      </Animated.View>

      {/* Central focal glow — behind the scene's focal element. */}
      <Animated.View style={[styles.focal, focalStyle]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="exFocal" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={accentColor} stopOpacity={0.5} />
              <Stop offset="0.4" stopColor={accentColor} stopOpacity={0.14} />
              <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#exFocal)" />
        </Svg>
      </Animated.View>

      {/* Twinkling stars — a second thin layer whose opacity loops. */}
      <Animated.View style={[StyleSheet.absoluteFill, twinkleStyle]}>
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid slice"
        >
          {STARS.filter((s) => s.tw).map((s, i) => (
            <Circle
              key={`tw${i}`}
              cx={s.x * VB_W}
              cy={s.y * VB_H}
              r={s.r + 0.3}
              fill={hexAlpha('#eaf2ff', 0.9)}
            />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Upper-third nebula, pulled off-centre to the right so the field
  // doesn't feel symmetrical / logo-like.
  nebula: {
    position: 'absolute',
    top: '-8%',
    left: '2%',
    width: '116%',
    height: '58%',
  },
  focal: {
    position: 'absolute',
    top: '28%',
    left: '10%',
    width: '80%',
    height: '52%',
  },
});
