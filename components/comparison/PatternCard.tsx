import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
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
import { Calendar, Clock, Waves, type LucideIcon } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { COMP, compColors, compHexAlpha } from './comparisonTheme';
import type { PatternsData } from './__mockData';

/**
 * Community Patterns — 3 read-only aggregate cards at the bottom
 * of the FULL state. Each is a distinct visualisation matched to
 * the shape of its insight:
 *
 *   • `clock`  — 24h radial with the peak window (19–22h) drawn
 *                as a glowing gradient arc that sweeps into place
 *   • `wave`   — layered sinus waves drifting infinitely, with a
 *                big count-up on the effectiveness percentage
 *   • `bar`    — 7-day bar chart, hardest day (Tuesday) as the
 *                tallest accent-tinted bar with a slow glow loop
 *
 * All three share the same glass-card chassis (icon + title +
 * viz body) but the viz itself is a per-kind dispatch. Cards
 * enter with 60ms stagger from the parent.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(Svg);
void AnimatedG; // reserved for future viz-level animation

const ICONS = {
  clock: Clock,
  wave: Waves,
  bar: Calendar,
} as const;

type Kind = 'clock' | 'wave' | 'bar';

type Props = {
  kind: Kind;
  data: PatternsData;
  addiction: Addiction;
  index: number;
};

export function PatternCard({ kind, data, addiction, index }: Props) {
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

  // Wave card uses success green; clock + bar use addiction accent.
  const cardColor = kind === 'wave' ? compColors.success : addiction.color;
  const alpha = (a: number) => compHexAlpha(cardColor, a);
  const Icon: LucideIcon = ICONS[kind];

  // Card enter stagger
  const cardOp = useSharedValue(0);
  const cardTy = useSharedValue(12);
  useEffect(() => {
    if (reducedMotion) {
      cardOp.value = 1;
      cardTy.value = 0;
      return;
    }
    const delay = index * 60;
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
  }, [reducedMotion, index, cardOp, cardTy]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOp.value,
    transform: [{ translateY: cardTy.value }],
  }));

  // ─────────────────── Title copy ───────────────────
  let title: string;
  if (kind === 'clock') {
    const start = data.clock.startHour;
    const end = data.clock.endHour;
    const to12 = (h: number) => (h % 12 || 12).toString();
    const ampm = end < 12 ? 'AM' : 'PM';
    title = t('comparison.pattern.clock_title', {
      start: to12(start),
      end: to12(end),
      ampm,
    });
  } else if (kind === 'wave') {
    title = t('comparison.pattern.wave_title', {
      technique: data.wave.techniqueLabel,
    });
  } else {
    const dayName = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ][data.bar.hardestDayIdx];
    title = t('comparison.pattern.bar_title', { day: dayName });
  }

  return (
    <Animated.View
      style={[styles.card, { borderColor: alpha(0.22) }, cardStyle]}
    >
      <View
        pointerEvents="none"
        style={[styles.halo, { backgroundColor: alpha(0.16) }]}
      />

      <View style={styles.headRow}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: alpha(0.16),
              borderColor: alpha(0.34),
            },
          ]}
        >
          <Icon size={19} color={cardColor} strokeWidth={2} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>

      <View style={styles.vizWrap}>
        {kind === 'clock' ? (
          <ClockViz
            data={data.clock}
            color={cardColor}
            reduced={reducedMotion}
          />
        ) : kind === 'wave' ? (
          <WaveViz data={data.wave} color={cardColor} reduced={reducedMotion} />
        ) : (
          <BarViz data={data.bar} color={cardColor} reduced={reducedMotion} />
        )}
      </View>
    </Animated.View>
  );
}

// ─────────────────── Clock viz — 24h radial ───────────────────

function ClockViz({
  data,
  color,
  reduced,
}: {
  data: PatternsData['clock'];
  color: string;
  reduced: boolean;
}) {
  const cx = 60;
  const cy = 60;
  const r = 52;

  // 24 tick marks; every 6th is a "major" tick.
  const ticks = [];
  for (let h = 0; h < 24; h++) {
    const ang = ((h / 24) * 360 - 90) * (Math.PI / 180);
    const major = h % 6 === 0;
    const r1 = major ? 39 : 42;
    const r2 = 46;
    ticks.push({
      x1: cx + r1 * Math.cos(ang),
      y1: cy + r1 * Math.sin(ang),
      x2: cx + r2 * Math.cos(ang),
      y2: cy + r2 * Math.sin(ang),
      major,
    });
  }

  // Peak arc between startHour and endHour.
  const angFor = (h: number) => ((h / 24) * 360 - 90) * (Math.PI / 180);
  const a0 = angFor(data.startHour);
  const a1 = angFor(data.endHour);
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  const arcD = `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;

  // Sweep animation: 60px dash goes from 60→0.
  const ARC_LEN = 60;
  const dashOff = useSharedValue(reduced ? 0 : ARC_LEN);
  useEffect(() => {
    if (reduced) {
      dashOff.value = 0;
      return;
    }
    dashOff.value = withDelay(
      100,
      withTiming(0, {
        duration: COMP.clockSweepMs,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [reduced, dashOff]);
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOff.value,
  }));

  // Endpoint dot spring pop
  const dotOp = useSharedValue(reduced ? 1 : 0);
  const dotScale = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    dotOp.value = withDelay(850, withTiming(1, { duration: 200 }));
    dotScale.value = withDelay(
      850,
      withSequence(
        withTiming(1.3, { duration: 280, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 200, easing: Easing.inOut(Easing.quad) })
      )
    );
  }, [reduced, dotOp, dotScale]);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOp.value,
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <View style={styles.clockRow}>
      <View style={styles.clockWrap}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Defs>
            <LinearGradient id="clkArc" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.35" />
              <Stop offset="1" stopColor={color} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {/* Base ring */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={7}
          />
          {/* Tick marks */}
          {ticks.map((tick, i) => (
            <Line
              key={i}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={
                tick.major ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'
              }
              strokeWidth={tick.major ? 1.4 : 1}
              strokeLinecap="round"
            />
          ))}
          {/* Peak arc — gradient stroke with sweep animation */}
          <AnimatedPath
            d={arcD}
            fill="none"
            stroke="url(#clkArc)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${ARC_LEN} ${ARC_LEN}`}
            animatedProps={arcProps}
          />
        </Svg>
        {/* Endpoint dot */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.clockDot,
            {
              left: x1 - 4,
              top: y1 - 4,
              backgroundColor: '#fff',
              shadowColor: color,
            },
            dotStyle,
          ]}
        />
        {/* Centered label */}
        <View pointerEvents="none" style={styles.clockLabelWrap}>
          <Text style={styles.clockNum}>
            {data.startHour % 12 || 12}–{data.endHour % 12 || 12}
          </Text>
          <Text style={[styles.clockAmPm, { color }]}>
            {data.endHour < 12 ? 'AM' : 'PM'}
          </Text>
        </View>
      </View>

      <View style={styles.clockRight}>
        <Text style={styles.clockHead}>
          {t('comparison.pattern.clock_headline')}
        </Text>
        <Text style={styles.clockBody}>
          {t('comparison.pattern.clock_body', { percent: data.sharePct })
            .split('%')[0]
            .replace(/\{\{percent\}\}/g, String(data.sharePct))}
          <Text style={[styles.clockBodyAccent, { color }]}>
            {data.sharePct}%
          </Text>
          {' of all cravings.'}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────── Wave viz — Urge Surfing ───────────────────

function WaveViz({
  data,
  color,
  reduced,
}: {
  data: PatternsData['wave'];
  color: string;
  reduced: boolean;
}) {
  return (
    <View
      style={[
        styles.waveWrap,
        {
          backgroundColor: compHexAlpha(color, 0.1),
          borderColor: compHexAlpha(color, 0.18),
        },
      ]}
    >
      <WaveLayer
        amp={7}
        yb={52}
        opacity={0.5}
        dur={COMP.waveMsSlow}
        color={color}
        reduced={reduced}
      />
      <WaveLayer
        amp={10}
        yb={58}
        opacity={0.32}
        dur={COMP.waveMsFast}
        color={color}
        reduced={reduced}
      />
      <View style={styles.waveTextBlock}>
        <View style={styles.wavePercentRow}>
          <WavePercentText
            target={data.successPct}
            color={color}
            reduced={reduced}
          />
          <Text style={[styles.wavePercentSuffix, { color }]}>%</Text>
        </View>
        <Text style={styles.waveBody}>{t('comparison.pattern.wave_body')}</Text>
      </View>
    </View>
  );
}

function WaveLayer({
  amp,
  yb,
  opacity,
  dur,
  color,
  reduced,
}: {
  amp: number;
  yb: number;
  opacity: number;
  dur: number;
  color: string;
  reduced: boolean;
}) {
  // Build a sinus path 2× the container width so the drift can go
  // from 0 to -50% and loop seamlessly.
  const W = 384;
  const H = 84;
  let d = `M0,${yb}`;
  for (let x = 0; x <= W; x += 6) {
    const y = yb - Math.sin((x * 2 * Math.PI) / 96) * amp;
    d += ` L${x},${y.toFixed(1)}`;
  }
  d += ` L${W},${H} L0,${H} Z`;

  const tx = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      tx.value = 0;
      return;
    }
    // waveMove2: 0 → -50% (relative to 200%-wide svg = -1 container width)
    tx.value = withRepeat(
      withTiming(-192, { duration: dur, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(tx);
  }, [reduced, dur, tx]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '200%',
          height: 84,
        },
        style,
      ]}
    >
      <Svg
        width="100%"
        height={84}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        <Path
          d={d}
          fill={compHexAlpha(color, opacity * 0.35)}
          stroke={compHexAlpha(color, opacity)}
          strokeWidth={1.6}
        />
      </Svg>
    </Animated.View>
  );
}

function WavePercentText({
  target,
  color,
  reduced,
}: {
  target: number;
  color: string;
  reduced: boolean;
}) {
  const [display, setDisplay] = useState(reduced ? target : 0);
  useEffect(() => {
    setDisplay(target);
    if (reduced) return;
    let cancelled = false;
    const rewind = setTimeout(() => {
      if (cancelled) return;
      setDisplay(0);
      const t0 = performance.now();
      const step = () => {
        if (cancelled) return;
        const p = Math.min(1, (performance.now() - t0) / COMP.countUpMs);
        const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        setDisplay(v);
        if (p < 1) requestAnimationFrame(step);
        else setDisplay(target);
      };
      requestAnimationFrame(step);
    }, 400);
    const safety = setTimeout(
      () => {
        if (!cancelled) setDisplay(target);
      },
      COMP.countUpMs * 3 + 400
    );
    return () => {
      cancelled = true;
      clearTimeout(rewind);
      clearTimeout(safety);
    };
  }, [target, reduced]);
  return <Text style={[styles.wavePercentText, { color }]}>{display}</Text>;
}

// ─────────────────── Bar viz — 7-day chart ───────────────────

function BarViz({
  data,
  color,
  reduced,
}: {
  data: PatternsData['bar'];
  color: string;
  reduced: boolean;
}) {
  const max = Math.max(...data.values);
  return (
    <View style={styles.barRow}>
      {data.values.map((v, i) => {
        const isHardest = i === data.hardestDayIdx;
        const height = Math.max(6, Math.round((v / max) * 54));
        return (
          <BarColumn
            key={i}
            index={i}
            isHardest={isHardest}
            height={height}
            label={data.labels[i]}
            color={color}
            reduced={reduced}
          />
        );
      })}
    </View>
  );
}

function BarColumn({
  index,
  isHardest,
  height,
  label,
  color,
  reduced,
}: {
  index: number;
  isHardest: boolean;
  height: number;
  label: string;
  color: string;
  reduced: boolean;
}) {
  const scaleY = useSharedValue(reduced ? 1 : 0);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      scaleY.value = 1;
      glow.value = 0;
      return;
    }
    scaleY.value = withDelay(
      index * 60,
      withTiming(1, {
        duration: COMP.barRiseMs,
        easing: Easing.out(Easing.cubic),
      })
    );
    if (isHardest) {
      // Continuous slow glow after the bar has settled.
      glow.value = withDelay(
        index * 60 + 700,
        withRepeat(
          withSequence(
            withTiming(1, {
              duration: COMP.barGlowMs / 2,
              easing: Easing.inOut(Easing.quad),
            }),
            withTiming(0, {
              duration: COMP.barGlowMs / 2,
              easing: Easing.inOut(Easing.quad),
            })
          ),
          -1,
          false
        )
      );
    }
    return () => {
      cancelAnimation(scaleY);
      cancelAnimation(glow);
    };
  }, [reduced, isHardest, index, scaleY, glow]);
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + glow.value * 0.5,
    ...Platform.select({
      web: {
        filter: `brightness(${1 + glow.value * 0.22}) drop-shadow(0 0 ${
          2 + glow.value * 9
        }px ${compHexAlpha(color, 0.9)})`,
      } as any,
      default: {},
    }),
  }));

  return (
    <View style={styles.barCol}>
      <View style={styles.barBox}>
        <Animated.View
          style={[
            styles.barBase,
            {
              height,
              backgroundColor: isHardest ? color : 'rgba(255,255,255,0.09)',
            },
            barStyle,
            isHardest ? glowStyle : null,
          ]}
        >
          {isHardest ? (
            <Svg width="100%" height={height} preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={`bar${index}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity="1" />
                  <Stop offset="1" stopColor={color} stopOpacity="0.5" />
                </LinearGradient>
              </Defs>
              <Rect
                x={0}
                y={0}
                width="100%"
                height={height}
                rx={4}
                ry={4}
                fill={`url(#bar${index})`}
              />
            </Svg>
          ) : null}
        </Animated.View>
      </View>
      <Text style={[styles.barLabel, { color: isHardest ? color : '#6a7899' }]}>
        {label}
      </Text>
    </View>
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
    right: -42,
    top: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    ...Platform.select({
      web: {
        filter: 'blur(16px)',
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
    lineHeight: 18,
  },
  vizWrap: {
    position: 'relative',
    marginTop: 15,
  },

  // Clock
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  clockWrap: {
    position: 'relative',
    width: 120,
    height: 120,
    flexShrink: 0,
  },
  clockDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 0 5px currentColor',
      },
      default: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
      },
    }),
  },
  clockLabelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 20,
  },
  clockAmPm: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 3,
  },
  clockRight: {
    flex: 1,
  },
  clockHead: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f2f6fc',
  },
  clockBody: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9fb0cc',
    lineHeight: 18,
    marginTop: 6,
  },
  clockBodyAccent: {
    fontWeight: '800',
  },

  // Wave
  waveWrap: {
    position: 'relative',
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  waveTextBlock: {
    position: 'absolute',
    left: 15,
    top: '50%',
    transform: [{ translateY: -18 }],
  },
  wavePercentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wavePercentText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
  },
  wavePercentSuffix: {
    fontSize: 18,
    fontWeight: '800',
  },
  waveBody: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#9fb0cc',
    marginTop: 3,
  },

  // Bar chart
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  barBox: {
    width: '100%',
    height: 54,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barBase: {
    width: '70%',
    borderRadius: 4,
    transformOrigin: 'bottom',
    overflow: 'hidden',
  },
  barLabel: {
    fontSize: 9.5,
    fontWeight: '700',
  },
});
