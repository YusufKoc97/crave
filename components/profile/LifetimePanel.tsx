import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';
import { t } from '@/lib/i18n';
import { CountUp } from './CountUp';
import { coreRadius, coreText, hexAlpha, CORE_ANIM } from './coreTheme';

/**
 * LIFETIME — "Aurora Veil".
 *
 * A quiet altar, not a dashboard. One gold hero number over a soft
 * drifting aurora (gold / violet / blue), and three equal medallions
 * hanging beneath it — streak, held, toolkit — with no connecting
 * thread.
 *
 * Why GOLD and not the app's blue: the blue accent (#5cc9f5) is the
 * language of the LIVE state — the rank ring, the current streak, "on
 * right now". Gold (#d6ad3d) is the language of the ACCUMULATED — a
 * lifetime. Both live on this screen without competing: the blue is
 * everywhere else, the gold is only here.
 *
 * The aurora blobs are SVG radial gradients (soft alpha falloff reads
 * as a blur without paying a per-frame blur cost), animated with a
 * translate + scale/skew drift only. Under reduced motion the drift
 * freezes and the count-ups snap to their targets.
 */

// ── Palette (gold is Lifetime-only; see the note above) ──
const GOLD = '#d6ad3d';
const VIOLET = 'rgb(178,120,220)'; // aurora fill only, nowhere else
const BLUE = '#5cc9f5'; // app accent's one gentle gesture here
const HERO_WARM = '#f7f3e8'; // broken white, tuned to sit with gold
const gold = (a: number) => hexAlpha(GOLD, a);

const HERO_H = 150;

type Props = {
  cravingsResisted: number;
  longestStreakDays: number;
  /** 0..1 */
  successRate: number;
  techniquesUsed: number;
  techniquesTotal: number;
};

export function LifetimePanel({
  cravingsResisted,
  longestStreakDays,
  successRate,
  techniquesUsed,
  techniquesTotal,
}: Props) {
  // Fresh account: nothing has been accumulated yet, so the panel dims
  // rather than celebrating a row of zeros. The aurora fades to a
  // quarter and stops; the medallions lose their gold and read grey.
  const fresh = cravingsResisted <= 0;

  return (
    <>
      <View style={styles.headRow}>
        <Text style={styles.headLabel}>{t('profile.lifetime_section')}</Text>
        <View style={styles.headRule} />
      </View>

      <View style={styles.panel}>
        <Hero value={cravingsResisted} fresh={fresh} />

        <View style={styles.medallions}>
          <Medallion
            value={longestStreakDays}
            unit={t('profile.stat_streak_unit_short')}
            label={t('profile.stat_streak_short')}
            delay={350}
            fresh={fresh}
          />
          <Medallion
            value={Math.round(successRate * 100)}
            unit="%"
            label={t('profile.stat_held_short')}
            delay={500}
            fresh={fresh}
          />
          <Medallion
            value={techniquesUsed}
            unit={`/${techniquesTotal}`}
            label={t('profile.stat_techniques_short')}
            delay={650}
            fresh={fresh}
          />
        </View>
      </View>

      {fresh ? (
        <Text style={styles.freshHint}>{t('profile.core_dormant_body')}</Text>
      ) : null}
    </>
  );
}

// ──────────────────────────── Hero ────────────────────────────

function Hero({ value, fresh }: { value: number; fresh: boolean }) {
  const display = useCountUpValue(value);

  return (
    <View style={styles.hero}>
      <View style={styles.auroraLayer} pointerEvents="none">
        {/* Render order = z-order: blue (coldest, faintest) at the
            bottom, violet filling the middle, gold dominant on top. */}
        <AuroraBlob
          w={220}
          h={50}
          centerPct={0.4}
          color={BLUE}
          alpha={0.28}
          durationMs={13000}
          variant="drift"
          fresh={fresh}
        />
        <AuroraBlob
          w={280}
          h={70}
          centerPct={0.52}
          color={VIOLET}
          alpha={0.45}
          durationMs={11000}
          variant="skew"
          fresh={fresh}
        />
        <AuroraBlob
          w={340}
          h={90}
          centerPct={0.44}
          color={GOLD}
          alpha={0.55}
          durationMs={9000}
          variant="drift"
          fresh={fresh}
        />
      </View>

      <View style={styles.heroContent}>
        {/* Gradient-filled number via SVG text — no MaskedView dep. The
            fill runs from a near-white top to gold, so the digit reads
            as struck metal rather than a flat swatch. */}
        <Svg width={220} height={78} viewBox="0 0 220 78">
          <Defs>
            <LinearGradient id="heroGold" x1="0" y1="0" x2="0.17" y2="1">
              <Stop offset="0.3" stopColor="#fffdf4" />
              <Stop offset="1" stopColor={gold(0.9)} />
            </LinearGradient>
          </Defs>
          <SvgText
            x="110"
            y="60"
            textAnchor="middle"
            fontSize={62}
            fontWeight="800"
            // Same tabular feel as the RN side; SVG has no
            // font-variant-numeric, but a fixed letterSpacing keeps the
            // count-up from jittering as digits change width.
            letterSpacing={-3}
            fill={fresh ? coreText.tertiary : 'url(#heroGold)'}
          >
            {display}
          </SvgText>
        </Svg>
        <Text style={[styles.heroCaption, fresh && styles.heroCaptionFresh]}>
          {t('profile.stat_cravings_resisted')}
        </Text>
      </View>
    </View>
  );
}

/**
 * One aurora blob: an SVG ellipse with a soft radial-gradient fill,
 * drifting on the X axis. `variant` picks the choreography — 'drift'
 * (translate + scaleX) for gold/blue, 'skew' (translate + skewX) for
 * the violet middle so the layers don't move in lockstep.
 */
function AuroraBlob({
  w,
  h,
  centerPct,
  color,
  alpha,
  durationMs,
  variant,
  fresh,
}: {
  w: number;
  h: number;
  centerPct: number;
  color: string;
  alpha: number;
  durationMs: number;
  variant: 'drift' | 'skew';
  fresh: boolean;
}) {
  const reduced = useReducedMotion();
  const still = reduced || fresh;
  const p = useSharedValue(0);

  useEffect(() => {
    if (still) {
      p.value = 0;
      return;
    }
    p.value = withRepeat(
      withTiming(1, {
        duration: durationMs / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, [p, still, durationMs]);

  const animStyle = useAnimatedStyle(() => {
    if (variant === 'skew') {
      // translateX +8 → -12, skewX -6° → +4°
      const tx = 8 + p.value * -20;
      const sk = -6 + p.value * 10;
      return { transform: [{ translateX: tx }, { skewX: `${sk}deg` }] };
    }
    // translateX -10 → +10, scaleX 1 → 1.08
    const tx = -10 + p.value * 20;
    const sx = 1 + p.value * 0.08;
    return { transform: [{ translateX: tx }, { scaleX: sx }] };
  });

  // Fresh drops every blob to a quarter of its alpha (design table).
  const a = fresh ? alpha * 0.25 : alpha;
  const gradId = `blob${w}${Math.round(centerPct * 100)}`;

  return (
    <Animated.View
      style={[
        styles.blob,
        { top: centerPct * HERO_H - h / 2, height: h, marginLeft: -w / 2 },
        animStyle,
      ]}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={gradId}>
            <Stop offset="0" stopColor={color} stopOpacity={a} />
            <Stop offset="0.7" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2}
          ry={h / 2}
          fill={`url(#${gradId})`}
        />
      </Svg>
    </Animated.View>
  );
}

// ──────────────────────────── Medallion ────────────────────────────

function Medallion({
  value,
  unit,
  label,
  delay,
  fresh,
}: {
  value: number;
  unit: string;
  label: string;
  delay: number;
  fresh: boolean;
}) {
  const reduced = useReducedMotion();
  const entering =
    reduced || fresh ? undefined : FadeInDown.delay(delay).duration(500);
  const gradId = `med${label}`;

  return (
    <Animated.View
      entering={entering}
      style={[styles.medallion, fresh && styles.medallionFresh]}
    >
      <Svg width={92} height={92} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Gold is confined to a top-left highlight; the well goes
              dark by half-radius so the medallion reads as a recessed
              coin, not a solid olive disc. r=0.9 pushed the dark stop
              past the rim and left the whole interior mid-transition. */}
          <RadialGradient id={gradId} cx="0.34" cy="0.27" r="0.8">
            <Stop
              offset="0"
              stopColor={GOLD}
              stopOpacity={fresh ? 0.06 : 0.2}
            />
            <Stop offset="0.5" stopColor="#0a0e1a" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#0a0e1a" stopOpacity={0.97} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={46} cy={46} rx={46} ry={46} fill={`url(#${gradId})`} />
      </Svg>

      <View style={styles.medValueRow}>
        <CountUp
          target={value}
          delay={delay}
          style={[styles.medValue, fresh && styles.medValueFresh]}
        />
        <Text style={[styles.medUnit, fresh && styles.medUnitFresh]}>
          {unit}
        </Text>
      </View>
      <Text style={styles.medLabel}>{label}</Text>
    </Animated.View>
  );
}

// ──────────────────────────── Count-up ────────────────────────────

/**
 * Same belt-and-braces roll as the CountUp component, but returning a
 * bare number so the hero can feed it into SVG text (which CountUp,
 * being an RN <Text>, can't render into).
 */
function useCountUpValue(target: number, delay = 0): number {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? target : 0);

  useEffect(() => {
    setV(target); // final value up front so a stalled rAF never sticks at 0
    if (reduced) return;
    let cancelled = false;
    const start = setTimeout(() => {
      if (cancelled) return;
      setV(0);
      const t0 = performance.now();
      const step = () => {
        if (cancelled) return;
        const pr = Math.min(1, (performance.now() - t0) / CORE_ANIM.countUpMs);
        setV(Math.round(target * (1 - Math.pow(1 - pr, 3))));
        if (pr < 1) requestAnimationFrame(step);
        else setV(target);
      };
      requestAnimationFrame(step);
    }, delay);
    const safety = setTimeout(
      () => {
        if (!cancelled) setV(target);
      },
      delay + CORE_ANIM.countUpMs * 3
    );
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearTimeout(safety);
    };
  }, [target, delay, reduced]);

  return v;
}

// ──────────────────────────── Styles ────────────────────────────

const styles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 30,
    marginBottom: 13,
  },
  headLabel: {
    color: coreText.sectionLabel,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  headRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },

  panel: {
    borderRadius: coreRadius.panel,
    backgroundColor: 'rgba(19,29,50,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 17,
    paddingTop: 14,
    paddingBottom: 18,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' },
      default: {},
    }),
  },

  // ── Hero ──
  hero: {
    height: HERO_H,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  auroraLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    left: '50%',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroCaption: {
    color: gold(0.85),
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  heroCaptionFresh: {
    color: coreText.tertiary,
  },

  // ── Medallions ──
  medallions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 18,
  },
  medallion: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: gold(0.45),
    ...Platform.select({
      web: {
        boxShadow: `0 0 14px ${gold(0.2)}, inset 0 1px 0 ${gold(0.32)}`,
      },
      default: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
      },
    }),
  },
  medallionFresh: {
    borderColor: gold(0.18),
    ...Platform.select({
      web: { boxShadow: 'none' },
      default: { shadowOpacity: 0 },
    }),
  },
  medValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
  },
  medValue: {
    color: HERO_WARM,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.9,
    fontVariant: ['tabular-nums'],
  },
  medValueFresh: {
    color: coreText.tertiary,
  },
  medUnit: {
    color: gold(0.85),
    fontSize: 12,
    fontWeight: '700',
  },
  medUnitFresh: {
    color: coreText.tertiary,
  },
  medLabel: {
    color: coreText.tertiary,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.6,
  },

  freshHint: {
    color: coreText.tertiary,
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
});
