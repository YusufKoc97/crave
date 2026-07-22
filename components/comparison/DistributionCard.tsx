import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
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
import {
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Timer,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { COMP, compColors, compHexAlpha } from './comparisonTheme';
import { bellPath, bellPointForZ, phi } from './bellMath';
import type { DistributionMetric } from './__mockData';

/**
 * You vs. Community — a single distribution card. Used ×3 in
 * FULL state (Resistance rate / Avg hold-out / Cravings-per-week).
 *
 * Anatomy:
 *   • Icon square (accent-tinted) + title + delta chip (fade in
 *     ~1s after mount, matches prototype timing).
 *   • Big count-up value + unit + "community avg X" sub-line.
 *   • SVG bell curve: pathDraw stroke animation + linear-gradient
 *     fill; center dashed vertical for the community average;
 *     "avg" label above.
 *   • User dot on the curve at value-normalized x — popIn scale
 *     entry + ambient pulseRing loop; connecting line down to
 *     baseline so the dot doesn't feel like it's floating.
 *   • Footer: `neutral` metrics get a proximity-to-mean line
 *     ("near the community middle" / lower / higher side); other
 *     metrics get the standard "Ahead of N% of the community".
 *
 * `ghost` variant (LowData state, M4) hides the user's value +
 * dot and swaps the footer for "Log more to see your standing".
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

const ICONS: Record<DistributionMetric['icon'], LucideIcon> = {
  'shield-check': ShieldCheck,
  timer: Timer,
  activity: Activity,
};

const W = 260;
const H = 76;
const BASE = 66;
const AMP = 54;
const PATH_DASH = 1400; // brief warning: must exceed the closed-path perimeter

type Props = {
  metric: DistributionMetric;
  addiction: Addiction;
  index: number;
  ghost?: boolean;
};

export function DistributionCard({
  metric,
  addiction,
  index,
  ghost = false,
}: Props) {
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

  const Icon = ICONS[metric.icon];
  const accentColor = addiction.color;
  const accentAlpha = (a: number) => compHexAlpha(accentColor, a);
  const goodTone = metric.tone === 'good';
  const neutral = metric.tone === 'neutral';

  // Bell-curve math: normalize the user's value to a z-score,
  // find its x on the curve. Percentile drives the footer.
  const z = (metric.youNum - metric.avg) / metric.sd;
  const point = bellPointForZ(W, BASE, AMP, z);
  const percentile = Math.round(phi(z) * 100);

  const path = bellPath(W, BASE, AMP);
  const gradId = `distGrad${metric.key}${index}`;

  // Card mount stagger + delta chip fade-in
  const cardOp = useSharedValue(0);
  const cardTy = useSharedValue(12);
  const chipOp = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      cardOp.value = 1;
      cardTy.value = 0;
      chipOp.value = 1;
      return;
    }
    const delay = index * COMP.cardStaggerMs;
    cardOp.value = withDelay(
      delay,
      withTiming(1, {
        duration: COMP.cardEnterMs,
        easing: Easing.out(Easing.cubic),
      })
    );
    cardTy.value = withDelay(
      delay,
      withTiming(0, {
        duration: COMP.cardEnterMs,
        easing: Easing.out(Easing.cubic),
      })
    );
    chipOp.value = withDelay(
      delay + COMP.deltaChipDelayMs,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
  }, [reducedMotion, index, cardOp, cardTy, chipOp]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOp.value,
    transform: [{ translateY: cardTy.value }],
  }));
  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipOp.value,
  }));

  // Bell stroke draw
  const dashOffset = useSharedValue(reducedMotion ? 0 : PATH_DASH);
  useEffect(() => {
    if (reducedMotion) {
      dashOffset.value = 0;
      return;
    }
    dashOffset.value = withDelay(
      index * COMP.cardStaggerMs + 100,
      withTiming(0, {
        duration: COMP.bellDrawMs,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [reducedMotion, index, dashOffset]);
  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  // User dot pop-in
  const dotScale = useSharedValue(reducedMotion ? 1 : 0.2);
  const dotOp = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion || ghost) {
      dotScale.value = 1;
      dotOp.value = ghost ? 0 : 1;
      return;
    }
    const d = index * COMP.cardStaggerMs + 350;
    dotOp.value = withDelay(d, withTiming(1, { duration: 200 }));
    dotScale.value = withDelay(
      d,
      withSequence(
        withTiming(1.25, {
          duration: 380,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) })
      )
    );
  }, [reducedMotion, ghost, index, dotScale, dotOp]);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOp.value,
    transform: [{ scale: dotScale.value }],
  }));

  // Ambient pulse ring around the dot
  const ring = useSharedValue(reducedMotion || ghost ? 1 : 0);
  useEffect(() => {
    if (reducedMotion || ghost) {
      ring.value = 1;
      return;
    }
    ring.value = withDelay(
      index * COMP.cardStaggerMs + 900,
      withRepeat(
        withTiming(1, {
          duration: COMP.dotPulseMs,
          easing: Easing.out(Easing.quad),
        }),
        -1,
        false
      )
    );
    return () => cancelAnimation(ring);
  }, [reducedMotion, ghost, index, ring]);
  const ringStyle = useAnimatedStyle(() => {
    const scale = 0.6 + ring.value * 1.8;
    const op = ring.value < 0.8 ? 1 - ring.value / 0.8 : 0;
    return {
      transform: [{ scale }],
      opacity: op,
    };
  });

  // ─────────────────── Footer text ───────────────────
  let footer: string;
  if (ghost) {
    footer = t('comparison.ghost_prompt');
  } else if (neutral) {
    if (Math.abs(z) < 0.5) footer = t('comparison.metric_near_middle');
    else if (z < 0) footer = t('comparison.metric_lower_side');
    else footer = t('comparison.metric_higher_side');
  } else {
    footer = t('comparison.metric_ahead', { percent: percentile });
  }

  // ─────────────────── Delta chip content ───────────────────
  const chipColor = ghost
    ? '#5a6b88'
    : goodTone
      ? compColors.success
      : '#9fb0cc';
  const chipBg = ghost
    ? 'rgba(255,255,255,0.05)'
    : goodTone
      ? compHexAlpha(compColors.success, 0.14)
      : 'rgba(159,176,204,0.12)';
  const chipBorder = ghost
    ? 'rgba(255,255,255,0.08)'
    : goodTone
      ? compHexAlpha(compColors.success, 0.34)
      : 'rgba(159,176,204,0.26)';

  return (
    <Animated.View
      style={[
        styles.card,
        {
          borderColor: ghost ? 'rgba(255,255,255,0.06)' : accentAlpha(0.22),
        },
        cardStyle,
      ]}
    >
      {/* Accent radial halo top-right */}
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            backgroundColor: ghost
              ? 'rgba(255,255,255,0.03)'
              : accentAlpha(0.16),
          },
        ]}
      />

      {/* Header: icon + title + delta chip */}
      <View style={styles.headRow}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: accentAlpha(0.16),
              borderColor: accentAlpha(0.34),
            },
          ]}
        >
          <Icon size={19} color={accentColor} strokeWidth={2} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {t(metric.labelKey)}
        </Text>
        {ghost ? (
          <View
            style={[
              styles.chip,
              { backgroundColor: chipBg, borderColor: chipBorder },
            ]}
          >
            <Text style={[styles.chipText, { color: chipColor }]}>—</Text>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.chip,
              { backgroundColor: chipBg, borderColor: chipBorder },
              chipStyle,
            ]}
          >
            {goodTone ? (
              <ArrowUpRight size={11} color={chipColor} strokeWidth={2.4} />
            ) : null}
            <Text style={[styles.chipText, { color: chipColor }]}>
              {metric.deltaLabel}
            </Text>
          </Animated.View>
        )}
      </View>

      {/* Big value + community avg */}
      <View style={styles.valueRow}>
        {ghost ? (
          <Text style={styles.ghostValue}>—</Text>
        ) : (
          <>
            <Text style={styles.valueText}>
              {metric.youNum}
              {metric.suffix ?? ''}
            </Text>
            {metric.unit ? (
              <Text style={styles.valueUnit}>{metric.unit}</Text>
            ) : null}
          </>
        )}
        <Text style={styles.avgText}>
          {t('comparison.metric_avg', { avg: metric.avgLabel })}
        </Text>
      </View>

      {/* Bell curve */}
      <View style={styles.bellWrap}>
        <Svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor={accentColor}
                stopOpacity={ghost ? 0.12 : 0.45}
              />
              <Stop offset="1" stopColor={accentColor} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <AnimatedPath
            d={path}
            fill={`url(#${gradId})`}
            stroke={accentColor}
            strokeWidth={1.4}
            strokeOpacity={ghost ? 0.2 : 0.5}
            strokeDasharray={`${PATH_DASH} ${PATH_DASH}`}
            animatedProps={pathProps}
          />
          <Line
            x1="0"
            y1={BASE}
            x2={W}
            y2={BASE}
            stroke={accentColor}
            strokeWidth={1.2}
            strokeOpacity={ghost ? 0.15 : 0.4}
          />
          <Line
            x1={W / 2}
            y1={8}
            x2={W / 2}
            y2={BASE}
            stroke={compColors.community}
            strokeWidth={1.4}
            strokeDasharray="2 3"
            strokeOpacity={0.8}
          />
        </Svg>

        {/* avg label above the center dashed line */}
        <View style={styles.avgLabelWrap} pointerEvents="none">
          <Text style={styles.avgLabel}>
            {t('comparison.metric_avg_label')}
          </Text>
        </View>

        {/* User dot + connecting line (skipped in ghost) */}
        {!ghost ? (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: `${point.xPct}%`,
                top: point.y,
                height: BASE - point.y,
                width: 2,
                marginLeft: -1,
                backgroundColor: accentAlpha(0.5),
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: `${point.xPct}%`,
                top: point.y,
                width: 16,
                height: 16,
                marginLeft: -8,
                marginTop: -8,
              }}
            >
              <Animated.View
                style={[
                  styles.dotRing,
                  { backgroundColor: accentAlpha(0.4) },
                  ringStyle,
                ]}
              />
              <Animated.View
                style={[
                  styles.dotCore,
                  {
                    backgroundColor: '#fff',
                    borderColor: '#fff',
                    shadowColor: accentColor,
                  },
                  dotStyle,
                ]}
              >
                <View
                  style={[styles.dotInner, { backgroundColor: accentColor }]}
                />
              </Animated.View>
            </View>
          </>
        ) : null}
      </View>

      {/* Footer */}
      <View style={styles.footerRow}>
        {!ghost && !neutral ? (
          <TrendingUp size={12} color={compColors.success} strokeWidth={2.4} />
        ) : null}
        <Text
          style={[
            styles.footerText,
            {
              color: ghost
                ? '#5a6b88'
                : neutral
                  ? '#9fb0cc'
                  : compColors.success,
            },
          ]}
        >
          {footer}
        </Text>
      </View>

      {metric.note && !ghost ? (
        <Text style={styles.noteText}>{t(metric.note)}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#0e1830',
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      default: {},
    }),
  },
  halo: {
    position: 'absolute',
    right: -40,
    top: -48,
    width: 130,
    height: 130,
    borderRadius: 65,
    ...Platform.select({
      web: {
        filter: 'blur(15px)',
      } as any,
      default: {},
    }),
  },
  headRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#e6ecf6',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  valueRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 12,
  },
  valueText: {
    fontSize: 31,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.7,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  valueUnit: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  ghostValue: {
    fontSize: 31,
    fontWeight: '800',
    color: '#5a6b88',
    letterSpacing: -0.7,
    lineHeight: 32,
  },
  avgText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: compColors.textMuted,
  },
  bellWrap: {
    position: 'relative',
    marginTop: 12,
    height: H,
  },
  avgLabelWrap: {
    position: 'absolute',
    left: '50%',
    top: 2,
    transform: [{ translateX: -8 }],
  },
  avgLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8a97b4',
  },
  dotRing: {
    position: 'absolute',
    inset: -5,
    borderRadius: 20,
    ...Platform.select({
      web: {
        filter: 'blur(4px)',
      } as any,
      default: {},
    }),
  },
  dotCore: {
    position: 'absolute',
    inset: 0,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 0 14px currentColor, 0 0 4px #fff',
      },
      default: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 8,
      },
    }),
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.85,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noteText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7a89a8',
    marginTop: 8,
  },
});
