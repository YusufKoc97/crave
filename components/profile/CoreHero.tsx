import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, RadialGradient, Stop } from 'react-native-svg';
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
import { RankEmblem, rankEmblemColor } from '@/components/ranks/RankEmblem';
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
 *   3. The core itself — the rank emblem, breathing gently and
 *      orbited by a single spark. (The organic blue blob that used
 *      to sit behind it was cut by explicit request: it read as a
 *      shapeless mass and stole the emblem's stage.)
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CORE_BOX = 104;
/** Rank emblem inside the ring. Sized so the emblem is the first
 *  thing the eye lands on — at 128 the frame nearly fills the ring
 *  (inner diameter ~152) and only the overflow ornaments approach
 *  it, which reads as intentional framing rather than a collision. */
const EMBLEM_SIZE = 128;
const CORE_HALF = CORE_BOX / 2;
const CENTER = HERO_SIZE / 2;

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
          <RankRing progress={progress} dormant={dormant} reduced={reduced} />
        </Svg>

        <CoreBlob rankOrder={rankOrder} dormant={dormant} alive={alive} />
        {alive ? <Spark /> : null}
      </View>

      {/* ── Identity block ─────────────────────────────────────── */}
      <Text style={styles.handle}>@{handle}</Text>
      {/* The rank name wears the rank's own colour everywhere in the
          app — and it stays subordinate to the emblem, which is the
          thing that should catch the eye first. */}
      <Text
        style={[styles.rankName, { color: rankEmblemColor(rankOrder - 1) }]}
      >
        {rankName}
      </Text>
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

/** Circular progress bar around the emblem. */
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
    // Gentler than the old blob's 1.07 swell — a 128px metal artifact
    // that visibly inflates reads as a glitch, not a breath.
    transform: [{ scale: 1 + (k.value - 1) * 0.45 }],
    // Brightness rides the same driver so swell and glow stay in
    // phase; dormant (zero points) just sits dimmer and still.
    opacity: (dormant ? 0.62 : 0.85) + ((k.value - 1) / 0.07) * 0.15,
  }));

  // The organic blue blob that used to sit behind the emblem is gone
  // (explicit request — it read as a shapeless mass and stole the
  // emblem's stage). The emblem now IS the core; its built-in halo is
  // boosted so it sits in light rather than floating like a sticker.
  return (
    <Animated.View pointerEvents="none" style={[styles.core, style]}>
      <View style={styles.emblem} accessible={false}>
        <RankEmblem tier={rankOrder - 1} size={EMBLEM_SIZE} haloBoost={1.7} />
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
    width: EMBLEM_SIZE,
    height: Math.round(EMBLEM_SIZE * 1.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblem: {
    // The emblem's ornaments overflow its frame by design, so the
    // box has to carry the same 1:1.16 ratio or the crown teeth and
    // the bottom spike get clipped.
    width: EMBLEM_SIZE,
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
    // Colour is injected per-rank at the call site. 24 instead of the
    // old 34: the emblem is the headline now, the name is its caption.
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
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
