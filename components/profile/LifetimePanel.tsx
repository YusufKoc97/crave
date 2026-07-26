import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ShieldCheck } from 'lucide-react-native';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';
import { t } from '@/lib/i18n';
import { CountUp } from './CountUp';
import { coreNeon, coreRadius, coreText, neon } from './coreTheme';
import { sparkAreaPath } from './coreMath';

/**
 * LIFETIME — one instrument panel, not four stat cards.
 *
 * The previous 2×2 grid gave four numbers equal weight, which made the
 * screen read as a dashboard. This panel establishes a hierarchy
 * instead: one hero number (cravings resisted, lifetime), a weekly
 * shape behind it, and three micro readings hanging off a hairline
 * rule underneath.
 *
 * The number-size rule the design leans on, hardest first:
 *   hero      46px  — one per panel
 *   reading   23px  — the three columns
 *   unit      11px  — never shares the number's weight
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPARK_W = 330;
// Short enough that even a peak week stays below the readings row's
// labels — the sparkline is the panel's floor, not a layer over it.
const SPARK_H = 46;

type Props = {
  cravingsResisted: number;
  /** 7 entries, index 0 = six days ago, index 6 = today. */
  weekly: readonly number[];
  longestStreakDays: number;
  /** 0..1 */
  successRate: number;
  techniquesUsed: number;
  techniquesTotal: number;
};

export function LifetimePanel({
  cravingsResisted,
  weekly,
  longestStreakDays,
  successRate,
  techniquesUsed,
  techniquesTotal,
}: Props) {
  const weekTotal = weekly.reduce((a, b) => a + b, 0);
  const weekMax = Math.max(1, ...weekly);

  return (
    <View style={styles.panel}>
      <Sparkline values={weekly} />

      <View style={styles.headRow}>
        <View style={styles.headLeft}>
          <View style={styles.heroRow}>
            <CountUp
              target={cravingsResisted}
              delay={120}
              format={(v) => v.toLocaleString('en-US')}
              style={styles.heroValue}
            />
            <ShieldCheck size={18} color={neon(0.85)} strokeWidth={2.2} />
          </View>
          <Text style={styles.heroCaption}>
            {t('profile.stat_cravings_resisted')}
          </Text>
        </View>

        <View style={styles.headRight}>
          <Text style={styles.weekLabel}>{t('profile.this_week')}</Text>
          <Text style={styles.weekDelta}>+{weekTotal}</Text>
        </View>
      </View>

      {/* 7-day pulse strip — today reads full-neon so the week has a
          "now" anchor even when the sparkline is flat. */}
      <View style={styles.pulseStrip}>
        {weekly.map((v, i) => {
          const today = i === weekly.length - 1;
          return (
            <View
              key={i}
              style={[
                styles.pulseTick,
                { height: 6 + (v / weekMax) * 14 },
                today
                  ? styles.pulseToday
                  : { backgroundColor: neon(0.14 + (v / weekMax) * 0.34) },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.rule} />

      <View style={styles.readings}>
        <Reading
          value={longestStreakDays}
          unit={t('profile.stat_streak_unit_short')}
          label={t('profile.stat_streak_short')}
          delay={140}
          // The streak is the number people actually come back to check,
          // so it gets the neon treatment while the other two readings
          // stay white. Only once there IS a streak — glowing a zero
          // would celebrate nothing.
          accent={longestStreakDays > 0}
          // No record to flag until there is actually a streak.
          badge={longestStreakDays > 0 ? t('profile.record_badge') : undefined}
          viz={<StreakTicks days={longestStreakDays} />}
        />
        <View style={styles.readingDivider} />
        <Reading
          value={Math.round(successRate * 100)}
          unit="%"
          label={t('profile.stat_rate_short')}
          delay={240}
          viz={<RateArc rate={successRate} />}
        />
        <View style={styles.readingDivider} />
        <Reading
          value={techniquesUsed}
          unit={`/${techniquesTotal}`}
          label={t('profile.stat_techniques_short')}
          delay={340}
          viz={
            <TechniqueSquares used={techniquesUsed} total={techniquesTotal} />
          }
        />
      </View>
    </View>
  );
}

// ──────────────────────────── Pieces ────────────────────────────

/** Weekly volume as a filled area pinned to the panel floor. */
function Sparkline({ values }: { values: readonly number[] }) {
  const reduced = useReducedMotion();
  const { line, area } = sparkAreaPath(values, SPARK_W, SPARK_H);
  // Generous: the path is never longer than its bounding box perimeter,
  // and an over-long dasharray just means the draw finishes early —
  // whereas an under-long one visibly clips the tail.
  const LEN = 1200;
  const drawn = useSharedValue(reduced ? LEN : 0);

  useEffect(() => {
    if (reduced) {
      drawn.value = LEN;
      return;
    }
    drawn.value = withDelay(
      400,
      withTiming(LEN, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [drawn, reduced]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [drawn.value, LEN],
  }));

  // An all-zero week would draw a flat rule along the panel floor,
  // which reads as a stray border rather than a chart.
  if (!line || values.every((v) => v === 0)) return null;

  return (
    <View pointerEvents="none" style={styles.sparkWrap}>
      <Svg
        width="100%"
        height={SPARK_H}
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={coreNeon} stopOpacity={0.13} />
            <Stop offset="100%" stopColor={coreNeon} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#sparkFill)" />
        {/* Kept faint on purpose: the readings row sits on top of this,
            and at the design's .5 the stroke cut straight through the
            column labels. It is atmosphere, not a chart to read off. */}
        <AnimatedPath
          d={line}
          fill="none"
          stroke={neon(0.26)}
          strokeWidth={1.5}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

function Reading({
  value,
  unit,
  label,
  delay,
  badge,
  accent,
  viz,
}: {
  value: number;
  unit: string;
  label: string;
  delay: number;
  badge?: string;
  /** Renders the number in neon with a glow — one reading per panel. */
  accent?: boolean;
  viz: React.ReactNode;
}) {
  return (
    <View style={styles.reading}>
      {viz}
      <View style={styles.readingValueRow}>
        <CountUp
          target={value}
          delay={delay}
          style={[styles.readingValue, accent && styles.readingValueAccent]}
        />
        <Text style={[styles.readingUnit, accent && styles.readingUnitAccent]}>
          {unit}
        </Text>
      </View>
      <View style={styles.readingLabelRow}>
        <Text style={styles.readingLabel} numberOfLines={1}>
          {label}
        </Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Twelve ticks brightening toward the streak length. */
function StreakTicks({ days }: { days: number }) {
  const lit = Math.min(12, days);
  return (
    <View style={styles.vizRow}>
      {Array.from({ length: 12 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.tick,
            { backgroundColor: neon(i < lit ? 0.35 + (i / 11) * 0.55 : 0.1) },
          ]}
        />
      ))}
    </View>
  );
}

/** A 22px ring whose arc length is the success rate. */
function RateArc({ rate }: { rate: number }) {
  const R = 9;
  const C = 2 * Math.PI * R;
  const on = C * Math.max(0, Math.min(1, rate));
  return (
    <View style={styles.vizRow}>
      <Svg width={22} height={22} viewBox="0 0 22 22">
        <Circle
          cx={11}
          cy={11}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={2}
        />
        <Circle
          cx={11}
          cy={11}
          r={R}
          fill="none"
          stroke={neon(0.9)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${on} ${C - on}`}
          transform="rotate(-90 11 11)"
        />
      </Svg>
    </View>
  );
}

/** Four squares, one per quarter of the toolkit. */
function TechniqueSquares({ used, total }: { used: number; total: number }) {
  const filled = total > 0 ? Math.round((used / total) * 4) : 0;
  return (
    <View style={styles.vizRow}>
      {Array.from({ length: 4 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.square,
            {
              backgroundColor: i < filled ? neon(0.65) : 'transparent',
              borderColor: neon(i < filled ? 0.65 : 0.2),
            },
          ]}
        />
      ))}
    </View>
  );
}

// ──────────────────────────── Styles ────────────────────────────

const styles = StyleSheet.create({
  panel: {
    borderRadius: coreRadius.panel,
    backgroundColor: 'rgba(19,29,50,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    // The sparkline is pinned to the panel floor and must not spill.
    overflow: 'hidden',
    position: 'relative',
  },
  sparkWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SPARK_H,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headLeft: {
    flex: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroValue: {
    color: coreText.title,
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -2.4,
    fontVariant: ['tabular-nums'],
  },
  heroCaption: {
    color: coreText.secondary,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  headRight: {
    alignItems: 'flex-end',
  },
  weekLabel: {
    color: coreText.sectionLabel,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  weekDelta: {
    color: neon(0.9),
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },

  pulseStrip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 20,
    marginTop: 14,
  },
  pulseTick: {
    width: 3,
    borderRadius: 1.5,
  },
  pulseToday: {
    backgroundColor: coreNeon,
    ...Platform.select({
      web: { boxShadow: `0 0 7px ${neon(0.8)}` },
      default: {
        shadowColor: coreNeon,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
      },
    }),
  },

  rule: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.055)',
    marginTop: 16,
  },

  readings: {
    flexDirection: 'row',
    marginTop: 14,
  },
  reading: {
    flex: 1,
    gap: 6,
  },
  readingDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.055)',
    marginHorizontal: 10,
  },
  readingValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  readingValue: {
    color: coreText.title,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -1.1,
    fontVariant: ['tabular-nums'],
  },
  // textShadow* is one of the few glow primitives RN honours on iOS,
  // Android and web alike — no Platform.select needed, unlike boxShadow.
  readingValueAccent: {
    color: coreNeon,
    fontSize: 26,
    textShadowColor: neon(0.55),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  readingUnit: {
    color: neon(0.8),
    fontSize: 11,
    fontWeight: '600',
  },
  readingUnitAccent: {
    color: coreNeon,
    fontSize: 12,
    fontWeight: '800',
  },
  readingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  readingLabel: {
    flexShrink: 1,
    color: coreText.tertiary,
    fontSize: 10.5,
    fontWeight: '600',
  },
  badge: {
    borderWidth: 1,
    borderColor: neon(0.28),
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  badgeText: {
    color: neon(0.85),
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.1,
  },

  vizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 22,
  },
  tick: {
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  square: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderWidth: 1,
    marginRight: 2,
  },
});
