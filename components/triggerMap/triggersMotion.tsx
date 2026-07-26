import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type TextStyle,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTriggersAccent } from './triggersAccent';

/**
 * Shared motion + in-card atmosphere for the Triggers sub-tab.
 *
 * Modül 4 (Comparison) ships three things that made it feel alive and
 * that Modül 3 was missing entirely: a staggered card entrance on
 * mount, numbers that count up from zero, and a soft accent-tinted
 * halo inside each card. This module is the Triggers equivalent.
 *
 * It deliberately duplicates Comparison's `COMP` timings + count-up
 * algorithm rather than importing them: Comparison is shipped and
 * working, and a shared module would couple two design systems that
 * are allowed to drift. The numbers below are copied from
 * `comparisonTheme.ts` so the two tabs feel like siblings today.
 *
 * Everything honours reduced-motion: entrances land instantly and
 * count-ups jump straight to their final value.
 */

export const TRIG_MOTION = {
  /** Delay between successive cards in a stack. */
  cardStaggerMs: 80,
  /** Card fade + rise duration. */
  cardEnterMs: 500,
  /** How far a card rises into place, in pt. */
  cardRisePx: 12,
  /** Count-up sweep duration. */
  countUpMs: 800,
  /** Extra delay before a card's numbers start counting. */
  countUpDelayMs: 220,
} as const;

/**
 * Read the OS reduced-motion flag once per mount.
 *
 * `AccessibilityInfo.isReduceMotionEnabled()` is async, so the first
 * render always reports `false`. Every consumer here starts its
 * animation from the "will animate" state, and the effect that reads
 * this flag runs after — so a reduced-motion user sees at most one
 * frame of the pre-animation state before it snaps to final.
 */
export function useReducedMotionFlag(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled) setReduced(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return reduced;
}

/**
 * Staggered fade + rise entrance. Returns a style to spread onto an
 * `Animated.View`.
 *
 * `index` is the card's position in its stack — the delay is
 * `index * cardStaggerMs`, matching Comparison's DistributionCard.
 */
export function useCardEntrance(index: number) {
  const reduced = useReducedMotionFlag();
  const op = useSharedValue(0);
  // Widened to `number` — `TRIG_MOTION` is `as const`, so the literal
  // type would pin the shared value to exactly 12 and reject 0.
  const ty = useSharedValue<number>(TRIG_MOTION.cardRisePx);

  useEffect(() => {
    if (reduced) {
      op.value = 1;
      ty.value = 0;
      return;
    }
    const delay = index * TRIG_MOTION.cardStaggerMs;
    const cfg = {
      duration: TRIG_MOTION.cardEnterMs,
      easing: Easing.out(Easing.cubic),
    };
    op.value = withDelay(delay, withTiming(1, cfg));
    ty.value = withDelay(delay, withTiming(0, cfg));
  }, [reduced, index, op, ty]);

  return useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }));
}

type CountUpProps = {
  /** Final value. */
  value: number;
  /** Milliseconds to wait before the sweep starts. */
  delay?: number;
  /** Rendered before / after the number. */
  prefix?: string;
  suffix?: string;
  /** Decimal places. Defaults to 0 (integers, locale-grouped). */
  decimals?: number;
  /**
   * Full override for the rendered string — use when the copy comes
   * from `t()` with the number interpolated, so the translation stays
   * in charge of where the "%" or unit goes.
   */
  format?: (n: number) => string;
  style?: TextStyle | TextStyle[];
};

/**
 * A number that sweeps 0 → `value` on mount (easeOut cubic).
 *
 * Ported from Comparison's `PulseCard` count-up, including its two
 * safety properties: the final value is committed *first* (so a
 * cancelled animation can never leave a stale 0 on screen), and a
 * timeout backstop re-commits it if rAF never fires — which happens
 * on RN Web when the tab is backgrounded mid-sweep.
 *
 * Returns the raw (unrounded) in-flight value so SVG callers can feed
 * it into an `<SvgText>`, which can't host a `<Text>` child.
 */
export function useCountUp(value: number, delay = 0): number {
  const reduced = useReducedMotionFlag();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    setDisplay(value); // final value first — never strand a 0
    if (reduced) return;

    let cancelled = false;
    const start = setTimeout(() => {
      if (cancelled) return;
      setDisplay(0);
      const startedAt = Date.now();
      const step = () => {
        if (cancelled) return;
        const p = Math.min(1, (Date.now() - startedAt) / TRIG_MOTION.countUpMs);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(value * eased);
        if (p < 1) requestAnimationFrame(step);
        else setDisplay(value);
      };
      requestAnimationFrame(step);
    }, delay);

    const backstop = setTimeout(
      () => {
        if (!cancelled) setDisplay(value);
      },
      delay + TRIG_MOTION.countUpMs * 3
    );

    return () => {
      cancelled = true;
      clearTimeout(start);
      clearTimeout(backstop);
    };
  }, [value, delay, reduced]);

  return display;
}

/** `useCountUp` rendered as text. */
export function CountUpText({
  value,
  delay = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  format,
  style,
}: CountUpProps) {
  const display = useCountUp(value, delay);

  if (format) {
    return (
      <Animated.Text style={style}>
        {format(
          decimals > 0 ? Number(display.toFixed(decimals)) : Math.round(display)
        )}
      </Animated.Text>
    );
  }

  const text =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('en-US');

  return (
    <Animated.Text style={style}>{`${prefix}${text}${suffix}`}</Animated.Text>
  );
}

// Monotonic gradient id source. `useId()` emits `:r0:`, which is an
// invalid SVG id and breaks `url(#…)` on web.
let auraSeq = 0;

type AuraProps = {
  /**
   * Corner the glow blooms from. Comparison anchors its card halos
   * top-right; `left` is here for cards whose content crowds that
   * corner.
   */
  corner?: 'right' | 'left';
  /** Peak opacity at the centre. Keep this low — "hafiften". */
  intensity?: number;
  /** Diameter of the glow in pt. */
  size?: number;
  /** Override the accent (e.g. a category colour). Defaults to the module accent. */
  color?: string;
};

/**
 * The soft accent bloom that sits inside a Triggers card, mirroring
 * Comparison's `StandingCard` halo.
 *
 * Rendered as an SVG <RadialGradient> rather than a CSS radial
 * gradient or `filter: blur()` — both are RN-Web-only and silently
 * disappear on device, which is the bug class this codebase keeps
 * hitting. Absolutely positioned and non-interactive, so it must be
 * the FIRST child of a card with `overflow: 'hidden'`.
 */
export function CardAura({
  corner = 'right',
  intensity = 0.16,
  size = 190,
  color,
}: AuraProps) {
  const { accent } = useTriggersAccent();
  const id = useRef(`trigAura${(auraSeq += 1)}`).current;
  const hue = color ?? accent;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.aura,
        { width: size, height: size, top: -size * 0.42 },
        corner === 'right' ? { right: -size * 0.28 } : { left: -size * 0.28 },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient
            id={id}
            cx="50"
            cy="50"
            rx="50"
            ry="50"
            fx="50"
            fy="50"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={hue} stopOpacity={intensity} />
            <Stop offset="55%" stopColor={hue} stopOpacity={intensity * 0.38} />
            <Stop offset="100%" stopColor={hue} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  aura: {
    position: 'absolute',
  },
});
