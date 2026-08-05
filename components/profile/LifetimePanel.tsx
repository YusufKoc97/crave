import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Rect,
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
import {
  coreRadius,
  coreSurface,
  coreText,
  hexAlpha,
  CORE_ANIM,
} from './coreTheme';

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
 * The aurora blobs are SVG radial gradients — no blur library ships in
 * this app, so a *multi-stop* alpha falloff (full → 0 across four
 * stops) fakes a gaussian blur without paying a per-frame blur cost.
 * They drift on translate + scale/skew only.
 *
 * The empty account is treated as a *beginning*, not a broken state:
 * the card stays fully alive (gold number, drifting aurora, lit
 * medallions) and simply reads zero, with a line of encouragement
 * underneath. It is never dimmed to a grey husk.
 */

// ── Palette (gold is Lifetime-only; see the note above) ──
const GOLD = '#d6ad3d';
const VIOLET = 'rgb(178,120,220)'; // aurora fill only, nowhere else
const AMBER = '#e6b866'; // warm counter-tone; the old cyan mixed to
// green over the gold blob, so the aurora now stays in the gold family
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
  // A fresh account still gets the full, alive treatment — it just
  // reads zero and gains a line of encouragement. `empty` only decides
  // whether to show that hint, no longer whether to dim the card.
  const empty = cravingsResisted <= 0;

  return (
    <>
      <View style={styles.headRow}>
        <Text style={styles.headLabel}>{t('profile.lifetime_section')}</Text>
        <View style={styles.headRule} />
      </View>

      <View style={styles.panel}>
        {/* Panel depth: a 165° navy→darker wash, since RN styles can't
            do linear-gradient() and there's no expo-linear-gradient. */}
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="panelBg" x1="0" y1="0" x2="0.26" y2="1">
              <Stop offset="0" stopColor={coreSurface.panelTop} />
              <Stop offset="1" stopColor={coreSurface.panelBottom} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#panelBg)" />
        </Svg>

        <Hero value={cravingsResisted} />

        <View style={styles.medallions}>
          <Medallion
            value={longestStreakDays}
            unit={t('profile.stat_streak_unit_short')}
            label={t('profile.stat_streak_short')}
            delay={350}
          />
          <Medallion
            value={Math.round(successRate * 100)}
            unit="%"
            label={t('profile.stat_held_short')}
            delay={500}
          />
          <Medallion
            value={techniquesUsed}
            unit={`/${techniquesTotal}`}
            label={t('profile.stat_techniques_short')}
            delay={650}
          />
        </View>
      </View>

      {empty ? (
        <Text style={styles.emptyHint}>{t('profile.core_dormant_body')}</Text>
      ) : null}
    </>
  );
}

// ──────────────────────────── Hero ────────────────────────────

function Hero({ value }: { value: number }) {
  const display = useCountUpValue(value);

  return (
    <View style={styles.hero}>
      <View style={styles.auroraLayer} pointerEvents="none">
        {/* Render order = z-order: amber (faintest) at the bottom,
            violet filling the middle, gold dominant on top — all warm,
            no cyan, so nothing mixes to green. */}
        <AuroraBlob
          w={250}
          h={58}
          centerPct={0.4}
          color={AMBER}
          alpha={0.28}
          blurPx={16}
          durationMs={13000}
          variant="drift"
        />
        <AuroraBlob
          w={320}
          h={80}
          centerPct={0.52}
          color={VIOLET}
          alpha={0.45}
          blurPx={20}
          durationMs={11000}
          variant="skew"
        />
        <AuroraBlob
          w={380}
          h={104}
          centerPct={0.44}
          color={GOLD}
          alpha={0.55}
          blurPx={18}
          durationMs={9000}
          variant="drift"
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
            fill="url(#heroGold)"
          >
            {display}
          </SvgText>
        </Svg>
        <Text style={styles.heroCaption}>
          {t('profile.stat_cravings_resisted')}
        </Text>
      </View>
    </View>
  );
}

/**
 * One aurora blob: an SVG ellipse with a *multi-stop* radial-gradient
 * fill (full → 0 across four stops, so the edge dissolves like a blur),
 * drifting on the X axis. `variant` picks the choreography — 'drift'
 * (translate + scaleX) for gold/blue, 'skew' (translate + skewX) for
 * the violet middle so the layers don't move in lockstep. On web an
 * extra CSS blur is layered on for the full dreamy handoff look; native
 * leans entirely on the gradient falloff.
 */
function AuroraBlob({
  w,
  h,
  centerPct,
  color,
  alpha,
  blurPx,
  durationMs,
  variant,
}: {
  w: number;
  h: number;
  centerPct: number;
  color: string;
  alpha: number;
  blurPx: number;
  durationMs: number;
  variant: 'drift' | 'skew';
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
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
  }, [p, reduced, durationMs]);

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

  const gradId = `blob${w}${Math.round(centerPct * 100)}`;

  return (
    <Animated.View
      style={[
        styles.blob,
        { top: centerPct * HERO_H - h / 2, height: h, marginLeft: -w / 2 },
        // Web gets a real gaussian blur on top of the soft gradient;
        // native ignores this key and relies on the multi-stop falloff.
        Platform.select({ web: { filter: `blur(${blurPx}px)` }, default: {} }),
        animStyle,
      ]}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={gradId}>
            <Stop offset="0" stopColor={color} stopOpacity={alpha} />
            <Stop offset="0.32" stopColor={color} stopOpacity={alpha * 0.62} />
            <Stop offset="0.58" stopColor={color} stopOpacity={alpha * 0.2} />
            <Stop offset="0.78" stopColor={color} stopOpacity={0} />
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
}: {
  value: number;
  unit: string;
  label: string;
  delay: number;
}) {
  const reduced = useReducedMotion();
  const entering = reduced ? undefined : FadeInDown.delay(delay).duration(500);
  const baseId = `medBase${label}`;
  const sheenId = `medSheen${label}`;

  return (
    <Animated.View entering={entering} style={styles.medallion}>
      {/* Two layers, never one: an OPAQUE domed-dark base, then an
          additive gold sheen on top. A single translucent radial (the
          old approach) let the panel bleed through and muddied to olive;
          painting the sheen over solid dark can only add warmth. */}
      <Svg width={92} height={92} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={baseId} cx="0.5" cy="0.4" r="0.75">
            <Stop offset="0" stopColor="#111a2e" stopOpacity={1} />
            <Stop offset="1" stopColor="#070b16" stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id={sheenId} cx="0.32" cy="0.26" r="0.62">
            <Stop offset="0" stopColor={GOLD} stopOpacity={0.24} />
            <Stop offset="0.55" stopColor={GOLD} stopOpacity={0.06} />
            <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={46} cy={46} rx={46} ry={46} fill={`url(#${baseId})`} />
        <Ellipse cx={46} cy={46} rx={46} ry={46} fill={`url(#${sheenId})`} />
      </Svg>

      <View style={styles.medValueRow}>
        <CountUp target={value} delay={delay} style={styles.medValue} />
        <Text style={styles.medUnit}>{unit}</Text>
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
  medUnit: {
    color: gold(0.85),
    fontSize: 12,
    fontWeight: '700',
  },
  medLabel: {
    color: coreText.tertiary,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.6,
  },

  emptyHint: {
    color: coreText.tertiary,
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
});
