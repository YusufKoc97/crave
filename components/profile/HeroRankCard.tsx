import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';
import { dsColors, dsFont, dsSpacing } from '@/constants/designSystem';
import { t } from '@/lib/i18n';
import type { OverallRankSnapshot } from '@/lib/overallRank';
import { CountUp } from './CountUp';
import { PROFILE_ANIM, hexAlpha, profileGold } from './profileTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Ring geometry — the avatar sits inside; arc tracks rank progress.
const RING_BOX = 112;
const RING_STROKE = 6;
const RING_RADIUS = (RING_BOX - RING_STROKE) / 2; // 53
const RING_C = 2 * Math.PI * RING_RADIUS;
const LEAD_DOT = 10; // glowing dot at the arc's leading edge
const AVATAR = 80;

type Props = {
  avatarGlyph: string;
  displayName: string;
  overall: OverallRankSnapshot;
  totalPoints: number;
};

/**
 * Hero rank card — the screen's light source.
 *
 *   • Gold radial ambient glow behind the whole card (8% opacity).
 *   • Avatar wrapped by a 6px progress ring that draws on 0 → progress
 *     over 900ms with a glowing dot riding the arc's leading edge.
 *   • Overall rank name + count-up total points.
 *   • Thin gold progress bar with the next-rank label at its right end.
 *   • 4 faint gold particles drifting inside the card only.
 */
export function HeroRankCard({
  avatarGlyph,
  displayName,
  overall,
  totalPoints,
}: Props) {
  const reduced = useReducedMotion();
  const progress = Math.max(0, Math.min(1, overall.progress));

  // Single shared value drives BOTH the arc draw-on and the leading dot.
  const p = useSharedValue(reduced ? progress : 0);
  useEffect(() => {
    if (reduced) {
      p.value = progress;
      return;
    }
    p.value = 0;
    p.value = withTiming(progress, {
      duration: PROFILE_ANIM.ringDrawMs,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(p);
  }, [progress, reduced, p]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - p.value),
  }));
  // Leading dot orbits the ring: 12 o'clock start (−90°) + swept angle.
  const dotOrbit = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-90 + p.value * 360}deg` }],
  }));

  return (
    <SurfaceCard variant="elevated" style={styles.card} radius={24}>
      {/* Gold ambient wash — large radius, low opacity: the card reads
          as the light source of the screen. */}
      <View style={styles.glowLayer} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="profileHeroGlow" cx="50%" cy="38%" r="65%">
              <Stop offset="0%" stopColor={profileGold} stopOpacity={0.08} />
              <Stop offset="55%" stopColor={profileGold} stopOpacity={0.03} />
              <Stop offset="100%" stopColor={profileGold} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#profileHeroGlow)"
          />
        </Svg>
      </View>

      {/* Drifting gold particles — inside the card only. */}
      <Particles reduced={reduced} />

      {/* Avatar + progress ring */}
      <View style={styles.ringWrap}>
        <Svg width={RING_BOX} height={RING_BOX}>
          <Circle
            cx={RING_BOX / 2}
            cy={RING_BOX / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={hexAlpha(profileGold, 0.13)}
            strokeWidth={RING_STROKE}
          />
          <AnimatedCircle
            cx={RING_BOX / 2}
            cy={RING_BOX / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={profileGold}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${RING_C} ${RING_C}`}
            animatedProps={arcProps}
            transform={`rotate(-90 ${RING_BOX / 2} ${RING_BOX / 2})`}
          />
        </Svg>

        {/* Leading-edge glowing dot */}
        {progress > 0.001 && (
          <Animated.View
            style={[styles.dotOrbit, dotOrbit]}
            pointerEvents="none"
          >
            <View style={styles.leadDot} />
          </Animated.View>
        )}

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarGlyph}</Text>
        </View>
      </View>

      <Text style={styles.usernameLabel} numberOfLines={1}>
        {displayName}
      </Text>

      <Text style={styles.overallKicker}>
        {t('profile.overall_rank_label')}
      </Text>
      <Text style={styles.overallRankName}>{overall.current.name}</Text>

      <CountUp
        target={totalPoints}
        format={(v) => t('profile.total_points', { count: v })}
        style={styles.totalPoints}
      />

      {/* Progress bar toward the next rank */}
      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <ProgressFill progress={progress} reduced={reduced} />
        </View>
        <Text style={styles.barEndLabel} numberOfLines={1}>
          {overall.next ? overall.next.name : t('journey.at_ceiling')}
        </Text>
      </View>
    </SurfaceCard>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function ProgressFill({
  progress,
  reduced,
}: {
  progress: number;
  reduced: boolean;
}) {
  const w = useSharedValue(reduced ? progress : 0);
  useEffect(() => {
    if (reduced) {
      w.value = progress;
      return;
    }
    w.value = 0;
    w.value = withTiming(progress, {
      duration: PROFILE_ANIM.barFillMs,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(w);
  }, [progress, reduced, w]);

  const style = useAnimatedStyle(() => ({
    width: `${Math.round(w.value * 100)}%`,
  }));
  return <Animated.View style={[styles.barFill, style]} />;
}

const PARTICLES = [
  { left: '18%', top: 34, size: 4, delay: 0, rise: 14 },
  { left: '72%', top: 52, size: 3, delay: 1600, rise: 18 },
  { left: '46%', top: 24, size: 3, delay: 3200, rise: 12 },
  { left: '84%', top: 92, size: 4, delay: 4800, rise: 16 },
] as const;

function Particles({ reduced }: { reduced: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLES.map((cfg, i) => (
        <Particle key={i} cfg={cfg} reduced={reduced} />
      ))}
    </View>
  );
}

function Particle({
  cfg,
  reduced,
}: {
  cfg: (typeof PARTICLES)[number];
  reduced: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(
      cfg.delay,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: PROFILE_ANIM.particleDriftMs / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: PROFILE_ANIM.particleDriftMs / 2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(t);
  }, [reduced, cfg.delay, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -t.value * cfg.rise }],
    // 10% base opacity, breathing subtly as it drifts.
    opacity: 0.06 + t.value * 0.06,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: cfg.left,
          top: cfg.top,
          width: cfg.size,
          height: cfg.size,
          borderRadius: cfg.size / 2,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    padding: dsSpacing.x3l,
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: dsSpacing.md,
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
    backgroundColor: profileGold,
  },
  ringWrap: {
    width: RING_BOX,
    height: RING_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOrbit: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  leadDot: {
    position: 'absolute',
    top: (RING_STROKE - LEAD_DOT) / 2,
    width: LEAD_DOT,
    height: LEAD_DOT,
    borderRadius: LEAD_DOT / 2,
    backgroundColor: profileGold,
    ...Platform.select({
      web: {
        boxShadow: '0 0 8px rgba(244,198,81,0.9)',
      },
      default: {
        shadowColor: profileGold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 5,
      },
    }),
  },
  avatar: {
    position: 'absolute',
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: hexAlpha(profileGold, 0.1),
    borderWidth: 1,
    borderColor: hexAlpha(profileGold, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: profileGold,
    fontSize: dsFont.size.displayMd,
    fontWeight: dsFont.weight.bold,
  },
  usernameLabel: {
    marginTop: dsSpacing.lg,
    color: dsColors.textPrimary,
    fontSize: dsFont.size.displaySm,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  overallKicker: {
    marginTop: dsSpacing.xl,
    color: dsColors.textSecondary,
    fontSize: dsFont.size.tiny,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.caps,
    textTransform: 'uppercase',
  },
  overallRankName: {
    marginTop: dsSpacing.sm,
    color: dsColors.textPrimary,
    fontSize: dsFont.size.displayMd,
    fontWeight: dsFont.weight.bold,
    letterSpacing: dsFont.letterSpacing.normal,
    textShadowColor: hexAlpha(profileGold, 0.5),
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  totalPoints: {
    marginTop: dsSpacing.sm,
    color: dsColors.textSecondary,
    fontSize: dsFont.size.body,
    fontWeight: dsFont.weight.regular,
    fontVariant: ['tabular-nums'],
  },
  barRow: {
    marginTop: dsSpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: dsSpacing.md,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: hexAlpha(profileGold, 0.12),
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: profileGold,
  },
  barEndLabel: {
    color: hexAlpha(profileGold, 0.85),
    fontSize: dsFont.size.tiny,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    maxWidth: 96,
  },
});
