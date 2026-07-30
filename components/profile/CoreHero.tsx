import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';
import { t } from '@/lib/i18n';
import { RankEmblem } from '@/components/ranks/RankEmblem';
import { CountUp } from './CountUp';
import { CORE_ANIM, coreNeon, coreText, neon } from './coreTheme';
import { HERO_SIZE, RING_C, RING_R } from './coreMath';

/**
 * "The Core" — the Profile hero.
 *
 * A 290×290 stage with three layers, back to front:
 *
 *   1. Ambient halo — a slow radial bloom so the hero sits in light
 *      instead of on a flat panel.
 *   2. Progress ring — a faint circular track around the emblem plus
 *      one neon arc whose sweep is the share of the current rank band
 *      already covered. (It replaced both the old nine-segment order
 *      ring and the horizontal bar under the points readout, and the
 *      per-addiction filaments/orbs were cut — the emblem is the
 *      hero now.)
 *   3. The core itself — an organic blob that breathes, carrying the
 *      rank emblem and orbited by a single spark.
 *
 * Two shape notes, both RN limitations the web reference doesn't have:
 *
 *   - The blob's asymmetric `border-radius` (`32% 68% … / 42% 36% …`)
 *     has no RN equivalent, so it is rebuilt as four elliptical SVG
 *     arcs with exactly the radii CSS would have resolved. The
 *     percentages in the handoff happen to sum to 100% per side, so
 *     no CSS overlap-scaling had to be replicated.
 *   - The blob's outer glow can't be a `boxShadow` (a View shadow
 *     would trace a rectangle, not the blob), so it is a separate SVG
 *     radial disc painted behind it. Works identically on both
 *     platforms, which `filter: drop-shadow` would not.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CORE_BOX = 104;
/** Rank emblem inside the core. Sized so the frame's facets read at
 *  a glance — the handoff's 64 was tuned for a slot that used to
 *  hold a single letter. 112 fills the ring (inner diameter ~152)
 *  without the ornaments touching it. */
const EMBLEM_SIZE = 112;
const CORE_HALF = CORE_BOX / 2;
const CENTER = HERO_SIZE / 2;

/**
 * The organic core outline, in a 104×104 box.
 *
 * Derived from `border-radius: 32% 68% 62% 38% / 42% 36% 64% 58%`:
 * each corner becomes one elliptical arc whose rx is the horizontal
 * percentage of the width and ry the vertical percentage of the
 * height. Adjacent radii sum to exactly 104 on every side, so the
 * straight segments between arcs have zero length and the outline is
 * a pure four-arc blob.
 */
const CORE_PATH = [
  'M33.3,0',
  'A70.7,37.4 0 0 1 104,37.4',
  'A64.5,66.6 0 0 1 39.5,104',
  'A39.5,60.3 0 0 1 0,43.7',
  'A33.3,43.7 0 0 1 33.3,0',
  'Z',
].join(' ');

type Props = {
  handle: string;
  rankName: string;
  nextRankName: string | null;
  totalPoints: number;
  pointsToNext: number | null;
  /** 0..1 through the current rank band. */
  progress: number;
  /** 1-based position of the current rank in the 9-step ladder. */
  rankOrder: number;
};

export function CoreHero({
  handle,
  rankName,
  nextRankName,
  totalPoints,
  pointsToNext,
  progress,
  rankOrder,
}: Props) {
  const reduced = useReducedMotion();
  // Zero points is a *beginning*, not a failure: the core dims rather
  // than breaking, and every ambient loop stands still until the first
  // craving is resisted.
  const dormant = totalPoints <= 0;
  const alive = !reduced && !dormant;

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Halo alive={alive} />
        <Svg
          width={HERO_SIZE}
          height={HERO_SIZE}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            {/* `coreFill` deliberately lives in CoreBlob's own <Svg>:
                react-native-svg scopes <Defs> per root on native, so a
                gradient declared here would resolve on web and render
                black on device. */}
            <RadialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <Stop
                offset="0%"
                stopColor={coreNeon}
                stopOpacity={dormant ? 0.12 : 0.34}
              />
              <Stop
                offset="60%"
                stopColor={coreNeon}
                stopOpacity={dormant ? 0.04 : 0.12}
              />
              <Stop offset="100%" stopColor={coreNeon} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          <RankRing progress={progress} dormant={dormant} reduced={reduced} />

          {/* Blob glow. Kept just wide enough to clear the 104px body —
              any larger and the falloff reads as a second sphere
              competing with the core instead of light around it. */}
          <Circle cx={CENTER} cy={CENTER} r={74} fill="url(#coreGlow)" />
        </Svg>

        <CoreBlob rankOrder={rankOrder} dormant={dormant} alive={alive} />
        {alive ? <Spark /> : null}
      </View>

      {/* ── Identity block ─────────────────────────────────────── */}
      <Text style={styles.handle}>@{handle}</Text>
      <Text style={styles.rankName}>{rankName}</Text>
      <Text style={styles.rankLabel}>{t('profile.overall_rank_label')}</Text>

      <View style={styles.pointsRow}>
        <CountUp
          target={totalPoints}
          delay={260}
          format={(v) => v.toLocaleString('en-US')}
          style={styles.pointsValue}
        />
        <Text style={styles.pointsUnit}>{t('profile.points_unit')}</Text>
      </View>

      <Text style={styles.subLine}>
        {dormant
          ? t('profile.core_dormant_hint')
          : pointsToNext != null && nextRankName
            ? t('profile.core_points_to_next', {
                points: pointsToNext.toLocaleString('en-US'),
                rank: nextRankName,
              })
            : t('profile.core_at_ceiling')}
      </Text>
    </View>
  );
}

// ───────────────────────────── Layers ─────────────────────────────

/** Slow ambient bloom pooled behind the whole hero. */
function Halo({ alive }: { alive: boolean }) {
  const k = useSharedValue(1);

  useEffect(() => {
    if (!alive) {
      k.value = 1;
      return;
    }
    k.value = withRepeat(
      withSequence(
        withTiming(1.06, {
          duration: CORE_ANIM.haloMs / 2,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1, {
          duration: CORE_ANIM.haloMs / 2,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      false
    );
  }, [alive, k]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: k.value }],
    opacity: 0.55 + (k.value - 1) * 4,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.halo, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="heroHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={coreNeon} stopOpacity={0.13} />
            <Stop offset="55%" stopColor={coreNeon} stopOpacity={0.05} />
            <Stop offset="100%" stopColor={coreNeon} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill="url(#heroHalo)" />
      </Svg>
    </Animated.View>
  );
}

/** Nine arcs, one per rank step. */
function RankRing({
  progress,
  dormant,
  reduced,
}: {
  /** 0..1 through the current rank band. */
  progress: number;
  dormant: boolean;
  reduced: boolean;
}) {
  // This ring used to encode rank ORDER as nine dashed segments while
  // a horizontal bar under the points readout carried band progress.
  // The bar is gone — the ring absorbed its job, so the score now
  // fills the circle around the emblem itself: a plain faint track
  // plus one neon arc whose sweep is the share of the current band
  // already covered.
  const sweep = useSharedValue(reduced ? progress : 0);

  useEffect(() => {
    if (reduced) {
      sweep.value = progress;
      return;
    }
    sweep.value = withDelay(
      CORE_ANIM.barDelayMs,
      withTiming(progress, {
        duration: CORE_ANIM.barFillMs,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [progress, reduced, sweep]);

  const fillProps = useAnimatedProps(() => {
    const p = Math.max(0, Math.min(1, sweep.value));
    return { strokeDasharray: [RING_C * p, RING_C * (1 - p) + 2] };
  });

  return (
    // A `transform` string rather than `rotation`/`origin`: the latter
    // pair makes react-native-svg emit a kebab-case `transform-origin`
    // attribute, which React rejects as an invalid DOM property on web.
    <G transform={`rotate(-90 ${CENTER} ${CENTER})`}>
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={RING_R}
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={5}
        fill="none"
      />
      {!dormant && (
        <>
          {/* `drop-shadow` is a web-only filter, so the glow is a
              second, wider, faded arc painted underneath. */}
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={RING_R}
            stroke={neon(0.22)}
            strokeWidth={13}
            strokeLinecap="round"
            fill="none"
            animatedProps={fillProps}
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={RING_R}
            stroke={coreNeon}
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
            animatedProps={fillProps}
          />
        </>
      )}
    </G>
  );
}

/** The breathing blob + emblem slot. */
function CoreBlob({
  rankOrder,
  dormant,
  alive,
}: {
  /** 1-based ladder position — the emblem takes a 0-based tier. */
  rankOrder: number;
  dormant: boolean;
  alive: boolean;
}) {
  const k = useSharedValue(1);

  useEffect(() => {
    if (!alive) {
      k.value = 1;
      return;
    }
    k.value = withRepeat(
      withSequence(
        withTiming(1.07, {
          duration: CORE_ANIM.breatheMs / 2,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1, {
          duration: CORE_ANIM.breatheMs / 2,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      false
    );
  }, [alive, k]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: k.value }],
    // 0.72 ↔ 1 tracked off the same driver so the swell and the
    // brightening are guaranteed to stay in phase.
    opacity: 0.72 + ((k.value - 1) / 0.07) * 0.28,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.core, style]}>
      <Svg width={CORE_BOX} height={CORE_BOX} viewBox="0 0 104 104">
        <Defs>
          <RadialGradient id="coreFill" cx="34%" cy="28%" r="78%">
            <Stop
              offset="0%"
              stopColor={coreNeon}
              stopOpacity={dormant ? 0.22 : 0.6}
            />
            <Stop offset="72%" stopColor="#0b1426" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Path
          d={CORE_PATH}
          fill="url(#coreFill)"
          stroke={neon(dormant ? 0.24 : 0.55)}
          strokeWidth={1}
        />
      </Svg>

      {/* Rank emblem. The old 64×64 slot held a placeholder hexagon
          and an initial; at that size the real emblem read as a
          smudge rather than a rank, so the box now follows the
          emblem's own 1:1.16 aspect and is large enough for the
          frame's facets and the sculpture to survive. */}
      <View style={styles.emblem} accessible={false}>
        <RankEmblem tier={rankOrder - 1} size={EMBLEM_SIZE} />
      </View>
    </Animated.View>
  );
}

/** A single 3px mote orbiting the core once every 16s. */
function Spark() {
  const a = useSharedValue(0);

  useEffect(() => {
    a.value = withRepeat(
      withTiming(1, { duration: CORE_ANIM.orbitMs, easing: Easing.linear }),
      -1,
      false
    );
  }, [a]);

  const style = useAnimatedStyle(() => {
    const rad = a.value * Math.PI * 2;
    const r = CORE_HALF + 8;
    return {
      transform: [
        { translateX: Math.cos(rad) * r },
        { translateY: Math.sin(rad) * r },
      ],
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.spark, style]} />;
}

// ───────────────────────────── Styles ─────────────────────────────

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  stage: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // The 420px halo is deliberately wider than the stage; without
    // this it would bleed over the section below.
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    width: 420,
    height: 420,
    left: CENTER - 210,
    top: CENTER - 210,
  },
  core: {
    position: 'absolute',
    width: CORE_BOX,
    height: CORE_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblem: {
    position: 'absolute',
    width: EMBLEM_SIZE,
    // The emblem's ornaments overflow its frame by design, so the
    // box has to carry the same 1:1.16 ratio or the crown teeth and
    // the bottom spike get clipped.
    height: Math.round(EMBLEM_SIZE * 1.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: coreNeon,
  },

  // ── Identity block ──
  handle: {
    color: coreText.secondary,
    fontSize: 13,
    fontWeight: '700',
    // The filament fan opens downward, so the bottom of the stage is
    // always empty. Reclaim it rather than shipping a dead band.
    marginTop: -26,
  },
  rankName: {
    color: coreText.title,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 6,
  },
  rankLabel: {
    color: neon(0.85),
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 10,
  },
  pointsValue: {
    color: coreText.title,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.9,
    fontVariant: ['tabular-nums'],
  },
  pointsUnit: {
    color: coreText.secondary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  subLine: {
    color: coreText.tertiary,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
});
