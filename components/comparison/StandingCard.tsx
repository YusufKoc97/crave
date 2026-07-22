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
import { TrendingUp, Trophy } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { COMP, compColors, compHexAlpha } from './comparisonTheme';
import { bellPath, bellPointForZ, bellZonePath } from './bellMath';
import type { StandingData } from './__mockData';

/**
 * YOUR STANDING — the percentile hero card. Bigger + louder than
 * DistributionCard because it's the emotional payoff of the pane:
 * "here's where you sit in the crowd, and it's a good place".
 *
 * Two tones:
 *   • `high` — addiction accent + Trophy icon + "You're in the
 *     top 25%" story
 *   • `low` — success green + TrendingUp icon + "You're building
 *     momentum" reframe (never shaming)
 *
 * Anatomy:
 *   • Kicker "YOUR STANDING" (accent-tinted)
 *   • Title (23px bold) + body — both fade+translate in AFTER the
 *     bell draws so the visual arrives before the words explain it
 *   • Larger SVG bell (300×120) with pathDraw stroke animation +
 *     linear-gradient fill
 *   • Baseline + 3 tick marks (left/middle/right axis anchors)
 *   • "your zone" second-bell fill: sub-path from user X to right
 *     edge, LinearGradient white→accent→transparent, fades in
 *   • Big user dot (20×20) with popIn scale + ambient pulseRing
 *     loop; connecting line to baseline
 *   • "You" pill below the dot — `youPill` keyframe declares the
 *     entire transform in from+to so keyed-remount doesn't clobber
 *     the -50%/150% centering
 *   • Axis labels: "Slower start / Steady resisters"
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

const W = 300;
const H = 120;
const BASE = 104;
const AMP = 86;
const PATH_DASH = 1400;

type Props = {
  addiction: Addiction;
  data: StandingData;
};

export function StandingCard({ addiction, data }: Props) {
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

  const isHigh = data.tone === 'high';
  // High-tone = addiction accent; low-tone = success green. The
  // fill gradient + stroke + dot glow all take this color so the
  // whole card reads as one tonal statement.
  const toneColor = isHigh ? addiction.color : compColors.success;
  const toneAlpha = (a: number) => compHexAlpha(toneColor, a);

  // The user's X-percent maps directly through to the bell
  // (StandingCard's data is already stated as percentPos rather
  // than a raw z-score — the story is "where you stand", not
  // "how many sd from mean").
  const z = ((data.percentPos - 50) / 100) * 6; // reverse-map to gaussian t
  const point = bellPointForZ(W, BASE, AMP, z);
  const path = bellPath(W, BASE, AMP);
  const zonePath = bellZonePath(W, BASE, AMP, point.x);

  // ─────────────────── Animations ───────────────────
  // Bell stroke draw
  const dashOffset = useSharedValue(reducedMotion ? 0 : PATH_DASH);
  // "Your zone" fill fade-in
  const zoneOp = useSharedValue(reducedMotion ? 1 : 0);
  // Text (title + body) fade+translate in
  const titleOp = useSharedValue(reducedMotion ? 1 : 0);
  const titleTy = useSharedValue(reducedMotion ? 0 : 8);
  const bodyOp = useSharedValue(reducedMotion ? 1 : 0);
  const bodyTy = useSharedValue(reducedMotion ? 0 : 8);
  // User dot popIn
  const dotScale = useSharedValue(reducedMotion ? 1 : 0.2);
  const dotOp = useSharedValue(reducedMotion ? 1 : 0);
  // Ambient pulse ring
  const ring = useSharedValue(reducedMotion ? 1 : 0);
  // "You" pill fade in
  const pillOp = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    dashOffset.value = withTiming(0, {
      duration: COMP.bellDrawMs,
      easing: Easing.out(Easing.cubic),
    });
    zoneOp.value = withDelay(550, withTiming(1, { duration: 500 }));
    titleOp.value = withDelay(700, withTiming(1, { duration: 500 }));
    titleTy.value = withDelay(
      700,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
    bodyOp.value = withDelay(820, withTiming(1, { duration: 500 }));
    bodyTy.value = withDelay(
      820,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
    dotOp.value = withDelay(250, withTiming(1, { duration: 200 }));
    dotScale.value = withDelay(
      250,
      withSequence(
        withTiming(1.25, {
          duration: 380,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) })
      )
    );
    ring.value = withDelay(
      600,
      withRepeat(
        withTiming(1, {
          duration: COMP.dotPulseMs,
          easing: Easing.out(Easing.quad),
        }),
        -1,
        false
      )
    );
    pillOp.value = withDelay(950, withTiming(1, { duration: 500 }));
    return () => {
      cancelAnimation(ring);
    };
  }, [
    reducedMotion,
    dashOffset,
    zoneOp,
    titleOp,
    titleTy,
    bodyOp,
    bodyTy,
    dotScale,
    dotOp,
    ring,
    pillOp,
  ]);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));
  const zoneProps = useAnimatedProps(() => ({
    opacity: zoneOp.value,
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOp.value,
    transform: [{ translateY: titleTy.value }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOp.value,
    transform: [{ translateY: bodyTy.value }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOp.value,
    transform: [{ scale: dotScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => {
    const scale = 0.6 + ring.value * 1.8;
    const op = ring.value < 0.8 ? 1 - ring.value / 0.8 : 0;
    return {
      transform: [{ scale }],
      opacity: op,
    };
  });
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOp.value,
  }));

  // ─────────────────── Copy ───────────────────
  const Icon = isHigh ? Trophy : TrendingUp;
  const percent = isHigh ? 100 - data.percentPos : Math.round(data.percentPos);
  const title = isHigh
    ? t('comparison.standing_high_title', { percent })
    : t('comparison.standing_low_title');
  const body = isHigh
    ? t('comparison.standing_high_body', { addiction: addiction.name })
    : t('comparison.standing_low_body', { percent });

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: toneAlpha(0.4),
        },
      ]}
    >
      {/* Card halo — positioned near the user X so the glow reads
          as "your zone is lit". */}
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            left: `${data.percentPos - 20}%`,
            backgroundColor: toneAlpha(0.22),
          },
        ]}
      />

      {/* Kicker */}
      <View style={styles.kickerRow}>
        <Icon size={12} color={toneAlpha(0.95)} strokeWidth={2.4} />
        <Text style={[styles.kicker, { color: toneAlpha(0.95) }]}>
          {t('comparison.your_standing_kicker')}
        </Text>
      </View>

      {/* Title + body */}
      <Animated.Text style={[styles.title, titleStyle]}>{title}</Animated.Text>
      <Animated.Text style={[styles.body, bodyStyle]}>{body}</Animated.Text>

      {/* Bell */}
      <View style={styles.bellWrap}>
        <Svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="bellFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={toneColor} stopOpacity="0.62" />
              <Stop offset="1" stopColor={toneColor} stopOpacity="0.04" />
            </LinearGradient>
            <LinearGradient id="bellZone" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
              <Stop offset="0.5" stopColor={toneColor} stopOpacity="0.7" />
              <Stop offset="1" stopColor={toneColor} stopOpacity="0.08" />
            </LinearGradient>
          </Defs>
          <AnimatedPath
            d={path}
            fill="url(#bellFill)"
            stroke={toneColor}
            strokeWidth={1.5}
            strokeOpacity="0.55"
            strokeDasharray={`${PATH_DASH} ${PATH_DASH}`}
            animatedProps={pathProps}
          />
          <Line
            x1="0"
            y1={BASE}
            x2={W}
            y2={BASE}
            stroke={toneColor}
            strokeWidth={1.2}
            strokeOpacity="0.4"
          />
          {/* 3 tick marks */}
          <Line
            x1="20"
            y1={BASE - 6}
            x2="20"
            y2={BASE + 4}
            stroke={toneColor}
            strokeOpacity="0.5"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <Line
            x1={W / 2}
            y1={BASE - 7}
            x2={W / 2}
            y2={BASE + 5}
            stroke={toneColor}
            strokeOpacity="0.55"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <Line
            x1={W - 20}
            y1={BASE - 6}
            x2={W - 20}
            y2={BASE + 4}
            stroke={toneColor}
            strokeOpacity="0.5"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          {/* Your zone fill */}
          <AnimatedPath
            d={zonePath}
            fill="url(#bellZone)"
            animatedProps={zoneProps}
          />
          {/* User connecting line inside SVG */}
          <Line
            x1={point.x}
            y1={point.y}
            x2={point.x}
            y2={BASE}
            stroke={toneColor}
            strokeWidth={1.5}
            strokeDasharray="2 3"
            strokeOpacity="0.7"
          />
        </Svg>

        {/* User dot (positioned in overlay) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${data.percentPos}%`,
            top: point.y,
            width: 20,
            height: 20,
            marginLeft: -10,
            marginTop: -10,
          }}
        >
          <Animated.View
            style={[
              styles.dotRing,
              { backgroundColor: toneAlpha(0.4) },
              ringStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.dotCore,
              {
                borderColor: '#fff',
                shadowColor: toneColor,
              },
              dotStyle,
            ]}
          >
            <View style={[styles.dotInner, { backgroundColor: toneColor }]} />
          </Animated.View>
        </View>

        {/* You pill — declared with a fixed absolute-left transform
            plus animated opacity only. The translate(-50%, ...) is
            in a static style so the `youPill` opacity animation
            can't clobber the centering. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.youPill,
            {
              left: `${data.percentPos}%`,
              top: point.y,
              backgroundColor: toneColor,
              shadowColor: toneColor,
            },
            pillStyle,
          ]}
        >
          <Text style={styles.youPillText}>You</Text>
        </Animated.View>

        {/* Axis labels */}
        <View style={styles.axisRow}>
          <Text style={styles.axisText}>
            {t('comparison.standing_axis_low')}
          </Text>
          <Text style={styles.axisText}>
            {t('comparison.standing_axis_high')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 20,
    paddingBottom: 18,
    backgroundColor: '#111a2f',
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      default: {},
    }),
  },
  halo: {
    position: 'absolute',
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    marginLeft: -40,
    ...Platform.select({
      web: {
        filter: 'blur(20px)',
      } as any,
      default: {},
    }),
  },
  kickerRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    position: 'relative',
    fontSize: 23,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 26,
    marginTop: 12,
    letterSpacing: -0.4,
  },
  body: {
    position: 'relative',
    fontSize: 12.5,
    fontWeight: '500',
    color: compColors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
  bellWrap: {
    position: 'relative',
    marginTop: 14,
    height: H + 24,
  },
  dotRing: {
    position: 'absolute',
    inset: -8,
    borderRadius: 20,
    ...Platform.select({
      web: {
        filter: 'blur(6px)',
      } as any,
      default: {},
    }),
  },
  dotCore: {
    position: 'absolute',
    inset: 0,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 0 20px currentColor, 0 0 6px #fff',
      },
      default: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 10,
      },
    }),
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.9,
  },
  youPill: {
    position: 'absolute',
    // Fixed transform: -50% x, +150% y from the anchor point (which
    // is `top: (point.y / H) * 100 + '%'`). The pill sits BELOW the
    // dot with a small gap. Animation only touches opacity to avoid
    // transform-clobber (design brief warning).
    transform: [{ translateX: -20 }, { translateY: 24 }],
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px currentColor',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.85,
        shadowRadius: 8,
      },
    }),
  },
  youPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#12172a',
  },
  axisRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#6a7899',
  },
});
