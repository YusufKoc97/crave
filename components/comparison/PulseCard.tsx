import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
import { Users } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { COMP, compColors, compHexAlpha } from './comparisonTheme';
import type { PulseData } from './__mockData';

/**
 * Community Pulse — the "living stats strip" that sits at the top
 * of the Comparison pane.
 *
 * Anatomy (top → bottom):
 *   • COMMUNITY PULSE kicker + Live-now dot (2s pulse-ring loop)
 *   • Hero count-up: "1,247 people resisting Nicotine this week"
 *   • Divider row: 8,432 cravings resisted | Stress 41%
 *   • Ticker row: 3 anonymous events crossfade every 4s
 *   • Background: radial breathing gradient (6s, low amplitude)
 *   • ECG heartbeat SVG at the bottom, stroke-dashoffset loop (4s)
 *
 * All animations run on the UI thread via Reanimated 4 shared
 * values. Reduced motion halts every loop and pins count-ups to
 * their final values (design brief: reduced-motion is mandatory).
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ECG path — same shape as the design prototype. Two heartbeat
// clusters over ~300 wide viewbox so the visual pulse reads.
const ECG_D =
  'M0,26 L40,26 L52,26 L60,10 L68,42 L78,26 L120,26 L132,26 L140,16 L148,36 L156,26 L200,26 L212,26 L220,12 L228,40 L236,26 L280,26 L300,26';
const ECG_DASH = 520;

type Props = {
  addiction: Addiction;
  data: PulseData;
};

export function PulseCard({ addiction, data }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (!cancelled) setReducedMotion(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const accentAlpha = (a: number) => compHexAlpha(addiction.color, a);

  return (
    <View style={styles.card}>
      {/* Breathing radial gradient in the top-right corner. Uses
          a View overlay (RN doesn't have radial-gradient bg on
          the base View), animated opacity to breathe. */}
      <BreathingHalo color={accentAlpha(0.14)} reduced={reducedMotion} />

      {/* ECG heartbeat line pinned to the bottom of the card. */}
      <View pointerEvents="none" style={styles.ecgWrap}>
        <ECGLine color={compColors.success} reduced={reducedMotion} />
      </View>

      {/* Header row: kicker + live-now dot */}
      <View style={styles.headerRow}>
        <View style={styles.kickerBlock}>
          <Users size={12} color={compColors.kicker} strokeWidth={2.4} />
          <Text style={styles.kickerText}>{t('comparison.pulse_kicker')}</Text>
        </View>
        <LiveDot color={compColors.success} reduced={reducedMotion} />
      </View>

      {/* Hero count-up */}
      <View style={styles.heroRow}>
        <CountUpText
          target={data.peopleThisWeek}
          delay={0}
          style={[
            styles.heroNumber,
            {
              textShadowColor: accentAlpha(0.55),
              textShadowRadius: 20,
            },
          ]}
          reduced={reducedMotion}
        />
        <Text style={styles.heroLabel}>
          {t('comparison.pulse_people', { addiction: addiction.name })}
        </Text>
      </View>

      {/* Divider row: cravings + top trigger */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerCol}>
          <CountUpText
            target={data.cravingsResisted}
            delay={COMP.countUpStaggerMs}
            style={styles.dividerNumber}
            reduced={reducedMotion}
          />
          <Text style={styles.dividerLabel}>
            {t('comparison.pulse_cravings_resisted')}
          </Text>
        </View>
        <View style={styles.dividerRule} />
        <View style={styles.dividerCol}>
          <View style={styles.stressRow}>
            <Text style={styles.stressLabel}>{data.topTrigger.label}</Text>
            <CountUpText
              target={data.topTrigger.percent}
              suffix="%"
              delay={COMP.countUpStaggerMs * 2}
              style={styles.stressNumber}
              reduced={reducedMotion}
            />
          </View>
          <Text style={styles.dividerLabel}>
            {t('comparison.pulse_common_trigger')}
          </Text>
        </View>
      </View>

      {/* Ticker */}
      <View style={styles.tickerWrap}>
        {data.ticker.map((line, i) => (
          <TickerLine
            key={line}
            index={i}
            total={data.ticker.length}
            text={line}
            dotColor={compColors.success}
            reduced={reducedMotion}
          />
        ))}
      </View>
    </View>
  );
}

// ─────────────────── Sub-components ───────────────────

function BreathingHalo({
  color,
  reduced,
}: {
  color: string;
  reduced: boolean;
}) {
  const opacity = useSharedValue(reduced ? 0.9 : 0.5);
  useEffect(() => {
    if (reduced) {
      opacity.value = 0.9;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, {
          duration: COMP.breatheMs / 2,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0.5, {
          duration: COMP.breatheMs / 2,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      false
    );
    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.breathe,
        {
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function ECGLine({ color, reduced }: { color: string; reduced: boolean }) {
  const offset = useSharedValue(reduced ? 0 : ECG_DASH);
  useEffect(() => {
    if (reduced) {
      offset.value = 0;
      return;
    }
    offset.value = withRepeat(
      withTiming(0, { duration: COMP.ecgDrawMs, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(offset);
  }, [reduced, offset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <Svg
      width="100%"
      height={52}
      viewBox="0 0 300 52"
      preserveAspectRatio="none"
      style={{ opacity: 0.5 }}
    >
      <AnimatedPath
        d={ECG_D}
        fill="none"
        stroke={compHexAlpha(color, 0.6)}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${ECG_DASH} ${ECG_DASH}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

function LiveDot({ color, reduced }: { color: string; reduced: boolean }) {
  const ring = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      ring.value = 1;
      return;
    }
    ring.value = withRepeat(
      withTiming(1, {
        duration: COMP.livePulseMs,
        easing: Easing.out(Easing.quad),
      }),
      -1,
      false
    );
    return () => cancelAnimation(ring);
  }, [reduced, ring]);

  const ringStyle = useAnimatedStyle(() => {
    // 0 → small + visible, 1 → big + invisible
    const scale = 0.6 + ring.value * 1.8;
    const op = ring.value < 0.8 ? 1 - ring.value / 0.8 : 0;
    return {
      transform: [{ scale }],
      opacity: op,
    };
  });

  return (
    <View style={styles.liveWrap}>
      <View style={styles.liveDotWrap}>
        <Animated.View
          style={[
            styles.liveRing,
            {
              backgroundColor: compHexAlpha(color, 0.5),
            },
            ringStyle,
          ]}
        />
        <View
          style={[
            styles.liveDot,
            {
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        />
      </View>
      <Text style={styles.liveText}>{t('comparison.pulse_live_now')}</Text>
    </View>
  );
}

/**
 * Count-up text with rAF-safety: final value is written up front,
 * then the animation replays from 0 → target so the user sees the
 * roll-up. If the animation is cancelled or Reanimated stalls, the
 * text already reads the target — matches the prototype's belt-
 * and-braces approach.
 */
function CountUpText({
  target,
  delay,
  suffix = '',
  style,
  reduced,
}: {
  target: number;
  delay: number;
  suffix?: string;
  style: React.ComponentProps<typeof Text>['style'];
  reduced: boolean;
}) {
  const [display, setDisplay] = useState(reduced ? target : 0);
  useEffect(() => {
    setDisplay(target); // guarantee final value first
    if (reduced) return;
    // Rewind to 0 then tween up.
    let cancelled = false;
    const timeoutRewind = setTimeout(() => {
      if (cancelled) return;
      setDisplay(0);
      const startAt = performance.now();
      const step = () => {
        if (cancelled) return;
        const now = performance.now();
        const p = Math.min(1, (now - startAt) / COMP.countUpMs);
        const eased = 1 - Math.pow(1 - p, 3); // easeOut cubic
        const v = Math.round(target * eased);
        setDisplay(v);
        if (p < 1) requestAnimationFrame(step);
        else setDisplay(target); // safety
      };
      requestAnimationFrame(step);
    }, delay);
    // Safety net: after 3× the animation window, force the final
    // value regardless of whether rAF fired.
    const safety = setTimeout(
      () => {
        if (!cancelled) setDisplay(target);
      },
      delay + COMP.countUpMs * 3
    );
    return () => {
      cancelled = true;
      clearTimeout(timeoutRewind);
      clearTimeout(safety);
    };
  }, [target, delay, reduced]);

  const formatted = display.toLocaleString('en-US') + suffix;
  return <Text style={style}>{formatted}</Text>;
}

function TickerLine({
  index,
  total,
  text,
  dotColor,
  reduced,
}: {
  index: number;
  total: number;
  text: string;
  dotColor: string;
  reduced: boolean;
}) {
  const slotMs = COMP.tickerCycleMs / total;
  const opacity = useSharedValue(reduced ? (index === 0 ? 1 : 0) : 0);
  const ty = useSharedValue(reduced ? 0 : 7);

  useEffect(() => {
    if (reduced) return;
    // Each line waits `index * slotMs` before its first appearance,
    // then plays a 3-phase cycle every `total * slotMs` ms.
    const cycle = COMP.tickerCycleMs;
    const startDelay = index * slotMs;

    const stepIn = withTiming(1, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
    const stepInY = withTiming(0, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
    const hold = withTiming(1, { duration: slotMs - 760 });
    const holdY = withTiming(0, { duration: slotMs - 760 });
    const stepOut = withTiming(0, {
      duration: 380,
      easing: Easing.in(Easing.cubic),
    });
    const stepOutY = withTiming(-7, {
      duration: 380,
      easing: Easing.in(Easing.cubic),
    });
    const rest = withTiming(0, { duration: cycle - slotMs });
    const restY = withTiming(-7, { duration: cycle - slotMs });

    opacity.value = withDelay(
      startDelay,
      withRepeat(withSequence(stepIn, hold, stepOut, rest), -1, false)
    );
    ty.value = withDelay(
      startDelay,
      withRepeat(withSequence(stepInY, holdY, stepOutY, restY), -1, false)
    );
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(ty);
    };
  }, [reduced, index, slotMs, opacity, ty]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View style={[styles.tickerItem, style]}>
      <View
        style={[
          styles.tickerDot,
          {
            backgroundColor: dotColor,
            shadowColor: dotColor,
          },
        ]}
      />
      <Text style={styles.tickerText} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#0e1830',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      default: {},
    }),
  },
  breathe: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    ...Platform.select({
      web: {
        filter: 'blur(30px)',
      } as any,
      default: {},
    }),
  },
  ecgWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    height: 52,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  kickerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kickerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: compColors.kicker,
  },
  liveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDotWrap: {
    position: 'relative',
    width: 8,
    height: 8,
  },
  liveRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: 4,
  },
  liveDot: {
    position: 'absolute',
    inset: 0,
    borderRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 0 8px currentColor',
      },
      default: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
    }),
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#93c3a0',
  },
  heroRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 14,
  },
  heroNumber: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#9fb0cc',
  },
  dividerRow: {
    position: 'relative',
    flexDirection: 'row',
    gap: 22,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  dividerCol: {
    minWidth: 0,
  },
  dividerRule: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerNumber: {
    fontSize: 19,
    fontWeight: '800',
    color: '#e6ecf6',
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  dividerLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#7a89a8',
    marginTop: 4,
  },
  stressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  stressLabel: {
    fontSize: 19,
    fontWeight: '800',
    color: compColors.stress,
    ...Platform.select({
      web: {
        textShadowColor: 'rgba(230,163,92,0.4)',
        textShadowRadius: 12,
      } as unknown as Record<string, unknown>,
      default: {},
    }),
  },
  stressNumber: {
    fontSize: 19,
    fontWeight: '800',
    color: compColors.stress,
    fontVariant: ['tabular-nums'],
  },
  tickerWrap: {
    position: 'relative',
    height: 18,
    marginTop: 14,
  },
  tickerItem: {
    position: 'absolute',
    inset: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  tickerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    ...Platform.select({
      web: {
        boxShadow: '0 0 6px currentColor',
      },
      default: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 3,
      },
    }),
  },
  tickerText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#9fb0cc',
    flex: 1,
  },
});
