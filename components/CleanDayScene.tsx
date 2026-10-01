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
 * The daily "craving-free day" check-in as a small centred popup.
 *
 * It asks FIRST and pays second: "Did you have any cravings yesterday?"
 * with two honest answers. "No cravings" claims the bonus, "Yes, I had
 * some" earns nothing and says so kindly (and the day is then not asked
 * again). There is deliberately no "not now" button — nobody declines
 * free points, and a way to skip the question is a way to dodge it.
 * Tapping outside still closes it without answering.
 *
 * Same vocabulary as the RESIST orb it sits over — concentric rings
 * breathing out from a lit centre — but in warm gold instead of the
 * app's blue/red, so a gift reads as different from a craving. The
 * emblem straddles the panel's top edge like a medal; the rings swell
 * out from behind the panel.
 *
 * Stages: ask → saved (burst, count-up, overall-rank bar)
 *         ask → honest (the "yes" answer)
 *
 * Perf: three looping rings + one breathing emblem, and a one-shot burst
 * of 14 dots on claim. Cheap on modern phones; worth a check on a
 * low-end Android before launch.
 */

const GOLD = '#FFC457';
const EMBLEM = 92;
const RING = 104;
const SPARKS = 14;
const CARD_MAX_W = 336;

const DISPLAY_FACE = Platform.select<TextStyle>({
  ios: { fontFamily: 'AvenirNext-DemiBold' },
  default: { fontWeight: '600' },
});

export type CleanDayStage = 'ask' | 'saved' | 'honest';

type Props = {
  visible: boolean;
  stage: CleanDayStage;
  points: number;
  /** Set once claimed: what was paid and the new overall total. */
  result: { points: number; total: number } | null;
  busy: boolean;
  /** "No cravings" — claim the bonus. */
  onNo: () => void;
  /** "Yes, I had some" — no bonus. */
  onYes: () => void;
  /** Tap outside: close without answering. */
  onDismiss: () => void;
  onContinue: () => void;
};

export function CleanDayScene({
  visible,
  stage,
  points,
  result,
  busy,
  onNo,
  onYes,
  onDismiss,
  onContinue,
}: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - 48, CARD_MAX_W);
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* The inner Pressable swallows taps so only the dim area dismisses. */}
        <Pressable style={{ width: cardW, alignItems: 'center' }}>
          {/* Behind the panel: rings, sparks and the emblem's glow, all
              centred on the emblem. The panel covers their lower half. */}
          <View style={[styles.halo, { width: cardW }]} pointerEvents="none">
            <PulseRing delay={0} />
            <PulseRing delay={1200} />
            <PulseRing delay={2400} />
            {Array.from({ length: SPARKS }, (_, i) => (
              <Spark key={i} index={i} burst={burst} />
            ))}
            <Animated.View style={[styles.emblemGlow, glowStyle]} />
          </View>

          <View style={[styles.card, { width: cardW }]}>
            {/* Warm light pooling at the top of the panel. */}
            <Svg
              width={cardW}
              height={260}
              style={styles.cardLight}
              pointerEvents="none"
            >
              <Defs>
                <RadialGradient
                  id="cd-card-glow"
                  cx={cardW / 2}
                  cy={0}
                  rx={cardW * 0.7}
                  ry={230}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={GOLD} stopOpacity={0.2} />
                  <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect
                x={0}
                y={0}
                width={cardW}
                height={260}
                fill="url(#cd-card-glow)"
              />
            </Svg>

            {stage === 'ask' ? (
              <Animated.View
                key="ask"
                entering={FadeIn.duration(320)}
                style={styles.content}
              >
                <Text style={styles.eyebrow}>{t('clean_day.eyebrow')}</Text>
                <Text style={styles.title}>{t('clean_day.title')}</Text>
                <Text style={styles.copy}>{t('clean_day.body')}</Text>
                <Pressable
                  style={[styles.cta, busy && styles.ctaBusy]}
                  onPress={onNo}
                  disabled={busy}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaText}>{t('clean_day.no')}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>+{points}</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.ghost, busy && styles.ctaBusy]}
                  onPress={onYes}
                  disabled={busy}
                  accessibilityRole="button"
                >
                  <Text style={styles.ghostText}>{t('clean_day.yes')}</Text>
                </Pressable>
              </Animated.View>
            ) : null}

            {stage === 'saved' ? (
              <Animated.View
                key="saved"
                entering={FadeInDown.duration(380)}
                style={styles.content}
              >
                <Text style={styles.eyebrow}>
                  {t('clean_day.saved_eyebrow')}
                </Text>
                <Text style={styles.title}>{t('clean_day.saved_title')}</Text>
                <CountUp
                  to={result?.points ?? points}
                  style={[styles.reward, DISPLAY_FACE]}
                />
                <Text style={styles.rewardLabel}>
                  {t('active.points_earned')}
                </Text>
                {result ? <RankStrip total={result.total} /> : null}
                <Pressable
                  style={styles.cta}
                  onPress={onContinue}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaText}>{t('clean_day.continue')}</Text>
                </Pressable>
              </Animated.View>
            ) : null}

            {stage === 'honest' ? (
              <Animated.View
                key="honest"
                entering={FadeInDown.duration(380)}
                style={styles.content}
              >
                <Text style={styles.eyebrow}>{t('clean_day.eyebrow')}</Text>
                <Text style={styles.title}>{t('clean_day.honest_title')}</Text>
                <Text style={styles.copy}>{t('clean_day.honest_body')}</Text>
                <Pressable
                  style={styles.cta}
                  onPress={onContinue}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaText}>{t('clean_day.got_it')}</Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </View>

          {/* The emblem sits on the panel's top edge, above it. */}
          <Animated.View
            style={[styles.emblem, emblemStyle]}
            pointerEvents="none"
          >
            <Sunrise size={42} color={GOLD} strokeWidth={1.6} />
          </Animated.View>
        </Pressable>
      </Pressable>
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
    opacity: interpolate(p.value, [0, 0.15, 1], [0, 0.5, 0]),
    transform: [{ scale: interpolate(p.value, [0, 1], [0.9, 2.5]) }],
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
  const dist = 78 + (index % 3) * 30;
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  halo: {
    position: 'absolute',
    top: 0,
    height: EMBLEM,
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
    boxShadow: `0 0 54px 8px ${hexAlpha(GOLD, 0.42)}`,
  },
  emblem: {
    position: 'absolute',
    top: 0,
    width: EMBLEM,
    height: EMBLEM,
    borderRadius: EMBLEM / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1D27',
    borderWidth: 1.5,
    borderColor: hexAlpha(GOLD, 0.7),
    boxShadow: `inset 0 0 20px ${hexAlpha(GOLD, 0.2)}`,
  },
  card: {
    marginTop: EMBLEM / 2,
    backgroundColor: '#0A1628',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: hexAlpha(GOLD, 0.26),
    overflow: 'hidden',
    boxShadow: `0 24px 60px rgba(0, 0, 0, 0.6), 0 0 36px ${hexAlpha(GOLD, 0.1)}`,
  },
  cardLight: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  content: {
    paddingTop: EMBLEM / 2 + 14,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  eyebrow: {
    color: hexAlpha(GOLD, 0.9),
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    color: '#F4F9FF',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 28,
    textAlign: 'center',
  },
  copy: {
    marginTop: 8,
    color: dsColors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  cta: {
    marginTop: 20,
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: GOLD,
    boxShadow: `0 6px 22px ${hexAlpha(GOLD, 0.3)}`,
  },
  ctaBusy: {
    opacity: 0.55,
  },
  ctaText: {
    color: '#0A1220',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 18, 32, 0.16)',
  },
  badgeText: {
    color: '#0A1220',
    fontSize: 13,
    fontWeight: '800',
  },
  ghost: {
    marginTop: 10,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(143, 165, 204, 0.3)',
  },
  ghostText: {
    color: dsColors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  reward: {
    marginTop: 10,
    color: GOLD,
    fontSize: 52,
    lineHeight: 60,
    fontVariant: ['tabular-nums'],
  },
  rewardLabel: {
    color: dsColors.textTertiary,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  strip: {
    marginTop: 18,
    width: '100%',
    alignItems: 'center',
  },
  stripTotal: {
    color: '#EAF3FF',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  track: {
    marginTop: 10,
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
    marginTop: 8,
    color: dsColors.textSecondary,
    fontSize: 12.5,
  },
});
