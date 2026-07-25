import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';
import {
  dsColors,
  dsFont,
  dsRadius,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import { CountUp } from './CountUp';
import {
  PROFILE_ANIM,
  profileGold,
  profileGoldDim,
  sparklinePath,
} from './profileTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Stats accent — the app's primary neon blue (hero stays gold). */
const statAccent = dsColors.accentBlue;

/**
 * Lifetime-stats grid — every card visualises its own datum instead of
 * just stating it, per the Profile redesign brief:
 *
 *   • Cravings resisted → weekly-trend sparkline behind the number.
 *   • Longest streak    → a row of dim→bright gold flame ticks.
 *   • Success rate      → the number inside a partial swept arc.
 *   • Techniques used   → four squares, N filled / rest hollow.
 *
 * Card size, radius and typography are identical to the previous plain
 * StatSquare — only the internal visualisation changes. Numbers roll up
 * with the shared CountUp; cards stagger by `countUpStaggerMs`.
 */

// ── Card shell ──────────────────────────────────────────────────

function StatShell({
  children,
  centered,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <SurfaceCard
      style={[styles.card, centered && styles.cardCentered]}
      radius={dsRadius.card}
    >
      {children}
    </SurfaceCard>
  );
}

// ── 1. Cravings resisted — sparkline behind the number ──────────

export function CravingsResistedCard({
  value,
  weekly,
  label,
  index = 0,
}: {
  value: number;
  weekly: readonly number[];
  label: string;
  index?: number;
}) {
  const d = sparklinePath(weekly, 100, 40, 2);
  return (
    <StatShell>
      {/* Weekly-trend sparkline — low-opacity accent, non-interactive. */}
      <View style={styles.sparkLayer} pointerEvents="none">
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
        >
          <Path
            d={d}
            fill="none"
            stroke={statAccent}
            strokeWidth={2}
            strokeOpacity={0.15}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <CountUp
        target={value}
        delay={index * PROFILE_ANIM.countUpStaggerMs}
        style={styles.value}
      />
      <Text style={styles.label}>{label}</Text>
    </StatShell>
  );
}

// ── 2. Longest streak — dim→bright gold flame ticks ─────────────

const MAX_FLAMES = 14;

/** Linear-interpolate two #rrggbb colours; t in [0,1]. */
function mixHex(a: string, b: string, tt: number): string {
  const pa = [
    parseInt(a.slice(1, 3), 16),
    parseInt(a.slice(3, 5), 16),
    parseInt(a.slice(5, 7), 16),
  ];
  const pb = [
    parseInt(b.slice(1, 3), 16),
    parseInt(b.slice(3, 5), 16),
    parseInt(b.slice(5, 7), 16),
  ];
  const ch = pa.map((v, i) =>
    Math.round(v + (pb[i] - v) * tt)
      .toString(16)
      .padStart(2, '0')
  );
  return `#${ch.join('')}`;
}

export function LongestStreakCard({
  value,
  label,
  index = 0,
}: {
  value: number;
  label: string;
  index?: number;
}) {
  const lit = Math.max(0, Math.min(value, MAX_FLAMES));
  const denom = Math.max(1, lit - 1);
  return (
    <StatShell>
      <CountUp
        target={value}
        delay={index * PROFILE_ANIM.countUpStaggerMs}
        style={styles.value}
      />
      <View style={styles.flameRow}>
        {Array.from({ length: lit }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.flameTick,
              {
                backgroundColor: mixHex(profileGoldDim, profileGold, i / denom),
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>{label}</Text>
    </StatShell>
  );
}

// ── 3. Success rate — number inside a partial swept arc ─────────

const ARC_BOX = 78;
const ARC_STROKE = 5;
const ARC_RADIUS = (ARC_BOX - ARC_STROKE) / 2;
const ARC_C = 2 * Math.PI * ARC_RADIUS;

export function SuccessRateCard({
  rate,
  label,
  index = 0,
}: {
  rate: number; // 0..1
  label: string;
  index?: number;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, rate));
  const p = useSharedValue(reduced ? clamped : 0);

  useEffect(() => {
    if (reduced) {
      p.value = clamped;
      return;
    }
    p.value = 0;
    p.value = withTiming(clamped, {
      duration: PROFILE_ANIM.ringDrawMs,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(p);
  }, [clamped, reduced, p]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_C * (1 - p.value),
  }));

  return (
    <StatShell centered>
      <View style={styles.arcWrap}>
        <Svg width={ARC_BOX} height={ARC_BOX}>
          <Circle
            cx={ARC_BOX / 2}
            cy={ARC_BOX / 2}
            r={ARC_RADIUS}
            fill="none"
            stroke={hexAlpha(statAccent, 0.13)}
            strokeWidth={ARC_STROKE}
          />
          <AnimatedCircle
            cx={ARC_BOX / 2}
            cy={ARC_BOX / 2}
            r={ARC_RADIUS}
            fill="none"
            stroke={statAccent}
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ARC_C} ${ARC_C}`}
            animatedProps={arcProps}
            transform={`rotate(-90 ${ARC_BOX / 2} ${ARC_BOX / 2})`}
          />
        </Svg>
        <View style={styles.arcCenter} pointerEvents="none">
          <CountUp
            target={Math.round(clamped * 100)}
            suffix="%"
            delay={index * PROFILE_ANIM.countUpStaggerMs}
            style={styles.value}
          />
        </View>
      </View>
      <Text style={[styles.label, styles.labelCentered]}>{label}</Text>
    </StatShell>
  );
}

// ── 4. Techniques used — four squares, N filled / rest hollow ───

export function TechniquesCard({
  used,
  total,
  label,
  index = 0,
}: {
  used: number;
  total: number;
  label: string;
  index?: number;
}) {
  const filled = Math.max(0, Math.min(used, total));
  return (
    <StatShell>
      <CountUp
        target={used}
        delay={index * PROFILE_ANIM.countUpStaggerMs}
        style={styles.value}
      />
      <View style={styles.squareRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.square,
              i < filled ? styles.squareFilled : styles.squareHollow,
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>{label}</Text>
    </StatShell>
  );
}

// ─────────────────────────── Styles ───────────────────────────

const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 128,
    padding: dsSpacing.xxl,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: dsSpacing.md,
  },
  value: {
    color: dsColors.textPrimary,
    fontSize: dsFont.size.displayLg,
    fontWeight: dsFont.weight.bold,
    fontVariant: ['tabular-nums'],
    lineHeight: dsFont.size.displayLg,
  },
  label: {
    marginTop: dsSpacing.md,
    color: dsColors.textSecondary,
    fontSize: dsFont.size.label,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  labelCentered: {
    marginTop: 0,
    textAlign: 'center',
  },

  // 1 — sparkline
  sparkLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },

  // 2 — flame ticks
  flameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginTop: dsSpacing.sm,
    height: 12,
  },
  flameTick: {
    width: 3,
    height: 11,
    borderRadius: 1.5,
  },

  // 3 — success arc
  arcWrap: {
    width: ARC_BOX,
    height: ARC_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 4 — technique squares
  squareRow: {
    flexDirection: 'row',
    gap: dsSpacing.sm,
    marginTop: dsSpacing.sm,
  },
  square: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  squareFilled: {
    backgroundColor: statAccent,
  },
  squareHollow: {
    borderWidth: 1.5,
    borderColor: hexAlpha(statAccent, 0.4),
  },
});
