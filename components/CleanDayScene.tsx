import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Sunrise } from 'lucide-react-native';
import { dsColors, hexAlpha } from '@/constants/designSystem';
import { overallRankFromTotalPoints } from '@/lib/overallRank';
import { hapticCelebrate } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * The daily "craving-free day" bonus as a full-bleed scene, not a card.
 *
 * Same vocabulary as the RESIST orb it sits next to — concentric rings
 * breathing out from a lit centre — but in warm gold instead of the
 * app's blue/red, so a gift reads as different from a craving. Two
 * stages share one stage of rings:
 *   ask   → sunrise emblem, "No cravings?", the +points, Claim / Not now
 *   saved → the emblem bursts, the number counts up, and the overall
 *           rank bar shows how far the bonus moved you.
 *
 * Perf: three looping rings + one breathing emblem while asking, and a
 * one-shot burst of 14 dots on claim. Cheap on modern phones; worth a
 * check on a low-end Android before launch.
 */

const GOLD = '#FFC457';
const STAGE_H = 300;
const EMBLEM = 128;
const RING = 150;
const SPARKS = 14;

const DISPLAY_FACE = Platform.select<TextStyle>({
  ios: { fontFamily: 'AvenirNext-DemiBold' },
  default: { fontWeight: '600' },
});

type Props = {
  visible: boolean;
  stage: 'ask' | 'saved';
  points: number;
  /** Set once claimed: what was paid and the new overall total. */
  result: { points: number; total: number } | null;
  busy: boolean;
  onClaim: () => void;
  onLater: () => void;
  onContinue: () => void;
};

export function CleanDayScene({
  visible,
  stage,
  points,
  result,
  busy,
  onClaim,
  onLater,
  onContinue,
}: Props) {
  const { width, height } = useWindowDimensions();
  const burst = useSharedValue(0);
  const pop = useSharedValue(1);
  const breathe = useSharedValue(0);

  // The emblem breathes while waiting for an answer.
  useEffect(() => {
    if (!visible) return;
    breathe.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(breathe);
  }, [visible, breathe]);

  // Claim → burst of sparks + a little pop on the emblem.
  useEffect(() => {
    if (stage !== 'saved') {
      burst.value = 0;
      return;
    }
    hapticCelebrate();
    burst.value = withTiming(1, {
      duration: 1100,
      easing: Easing.out(Easing.cubic),
    });
    pop.value = withSequence(
      withTiming(1.16, { duration: 170 }),
      withSpring(1, { damping: 9, stiffness: 140 })
    );
  }, [stage, burst, pop]);

  const emblemStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value * (1 + breathe.value * 0.035) }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + breathe.value * 0.3,
  }));

  const centerY = 110 + STAGE_H / 2;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onLater}
    >
      <View style={styles.root}>
        {/* Warm light behind the emblem, fading into the app's navy. */}
        <Svg
          width={width}
          height={height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient
              id="cd-glow"
              cx={width / 2}
              cy={centerY}
              rx={width * 0.95}
              ry={width * 0.95}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={GOLD} stopOpacity={0.2} />
              <Stop offset="0.38" stopColor="#2A6BB8" stopOpacity={0.09} />
              <Stop offset="1" stopColor={dsColors.bgBase} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="url(#cd-glow)"
          />
        </Svg>

        <View style={styles.stage} pointerEvents="none">
          <PulseRing delay={0} />
          <PulseRing delay={1200} />
          <PulseRing delay={2400} />

          {Array.from({ length: SPARKS }, (_, i) => (
            <Spark key={i} index={i} burst={burst} />
          ))}

          <Animated.View style={[styles.emblemGlow, glowStyle]} />
          <Animated.View style={[styles.emblem, emblemStyle]}>
            <Sunrise size={56} color={GOLD} strokeWidth={1.6} />
          </Animated.View>
        </View>

        {stage === 'ask' ? (
          <Animated.View
            key="ask"
            entering={FadeIn.duration(360)}
            style={styles.body}
          >
            <Text style={styles.eyebrow}>{t('clean_day.eyebrow')}</Text>
            <Text style={styles.title}>{t('clean_day.title')}</Text>
            <Text style={[styles.reward, DISPLAY_FACE]}>+{points}</Text>
            <Text style={styles.rewardLabel}>{t('clean_day.bonus_label')}</Text>
            <Text style={styles.copy}>{t('clean_day.body')}</Text>
          </Animated.View>
        ) : (
          <Animated.View
            key="saved"
            entering={FadeInDown.duration(420)}
            style={styles.body}
          >
            <Text style={styles.eyebrow}>{t('clean_day.saved_eyebrow')}</Text>
            <Text style={styles.title}>{t('clean_day.saved_title')}</Text>
            <CountUp
              to={result?.points ?? points}
              style={[styles.reward, DISPLAY_FACE]}
            />
            <Text style={styles.rewardLabel}>{t('active.points_earned')}</Text>
            {result ? <RankStrip total={result.total} /> : null}
          </Animated.View>
        )}

        <View style={styles.actions}>
          {stage === 'ask' ? (
            <>
              <Pressable
                style={[styles.cta, busy && styles.ctaBusy]}
                onPress={onClaim}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.ctaText}>
                  {t('clean_day.claim', { points })}
                </Text>
              </Pressable>
              <Pressable
                onPress={onLater}
                hitSlop={10}
                style={styles.later}
                accessibilityRole="button"
              >
                <Text style={styles.laterText}>{t('clean_day.later')}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.cta}
              onPress={onContinue}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>{t('clean_day.continue')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** A ring that swells out from the emblem and fades, on a staggered loop. */
function PulseRing({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 3600, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
    return () => cancelAnimation(p);
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.15, 1], [0, 0.42, 0]),
    transform: [{ scale: interpolate(p.value, [0, 1], [0.85, 2.2]) }],
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

/** One dot flung outward from the emblem when the bonus is claimed. */
function Spark({
  index,
  burst,
}: {
  index: number;
  burst: SharedValue<number>;
}) {
  const angle = (index / SPARKS) * Math.PI * 2 + (index % 2) * 0.18;
  const dist = 96 + (index % 3) * 34;
  const size = 4 + (index % 3) * 2;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(burst.value, [0, 0.12, 1], [0, 1, 0]),
    transform: [
      { translateX: Math.cos(angle) * dist * burst.value },
      { translateY: Math.sin(angle) * dist * burst.value },
      { scale: interpolate(burst.value, [0, 1], [1, 0.4]) },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.spark,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

/** "+N" that climbs from 0 to N so the payout is felt, not just read. */
function CountUp({
  to,
  style,
}: {
  to: number;
  style: (TextStyle | undefined)[];
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (to <= 0) {
      setShown(0);
      return;
    }
    const steps = 18;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(Math.round((to * i) / steps));
      if (i >= steps) clearInterval(id);
    }, 36);
    return () => clearInterval(id);
  }, [to]);
  return <Text style={style}>+{shown}</Text>;
}

/** Where the bonus left the user on the overall ladder. */
function RankStrip({ total }: { total: number }) {
  const rank = useMemo(() => overallRankFromTotalPoints(total), [total]);
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(
      350,
      withTiming(rank.progress, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [fill, rank.progress]);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, fill.value)) * 100}%`,
  }));
  return (
    <View style={styles.strip}>
      <Text style={styles.stripTotal}>
        {t('clean_day.total_line', { total })}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.trackFill, fillStyle]} />
      </View>
      <Text style={styles.stripNext}>
        {rank.next && rank.pointsToNext != null
          ? t('clean_day.to_next', {
              points: rank.pointsToNext,
              rank: rank.next.name,
            })
          : t('clean_day.top_rank')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dsColors.bgBase,
    alignItems: 'center',
  },
  stage: {
    marginTop: 110,
    width: '100%',
    height: STAGE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.2,
    borderColor: hexAlpha(GOLD, 0.6),
  },
  spark: {
    position: 'absolute',
    backgroundColor: GOLD,
  },
  emblemGlow: {
    position: 'absolute',
    width: EMBLEM,
    height: EMBLEM,
    borderRadius: EMBLEM / 2,
    boxShadow: `0 0 70px 10px ${hexAlpha(GOLD, 0.42)}`,
  },
  emblem: {
    width: EMBLEM,
    height: EMBLEM,
    borderRadius: EMBLEM / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexAlpha(GOLD, 0.08),
    borderWidth: 1.5,
    borderColor: hexAlpha(GOLD, 0.6),
    boxShadow: `inset 0 0 26px ${hexAlpha(GOLD, 0.16)}`,
  },
  body: {
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  eyebrow: {
    color: hexAlpha(GOLD, 0.85),
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 10,
    color: '#F4F9FF',
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  reward: {
    marginTop: 18,
    color: GOLD,
    fontSize: 60,
    lineHeight: 68,
    fontVariant: ['tabular-nums'],
  },
  rewardLabel: {
    marginTop: 0,
    color: dsColors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  copy: {
    marginTop: 18,
    maxWidth: 290,
    color: dsColors.textSecondary,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  strip: {
    marginTop: 26,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  stripTotal: {
    color: '#EAF3FF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  track: {
    marginTop: 12,
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(143, 165, 204, 0.16)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  stripNext: {
    marginTop: 10,
    color: dsColors.textSecondary,
    fontSize: 13,
  },
  actions: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 54,
    alignItems: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    boxShadow: `0 8px 28px ${hexAlpha(GOLD, 0.32)}`,
  },
  ctaBusy: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#0A1220',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  later: {
    marginTop: 16,
    paddingVertical: 6,
  },
  laterText: {
    color: dsColors.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
});
