import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Crown, Sunrise, type LucideIcon } from 'lucide-react-native';
import { hexAlpha } from '@/constants/designSystem';
import { PremiumButton } from './PremiumButton';

/**
 * Gilded premium pitch card — the shared "unlock" surface for free users
 * (Comparison launch state, Trigger Map gate). It wears the paywall's gold identity (same
 * GOLD + Crown as `app/paywall.tsx`) so the tap into the paywall feels
 * like a continuation, not a jump: gilded halo, a slow "breathing" glow
 * on the crown, optional one-glance benefits, and a gold CTA. Copy is
 * passed in by the caller; an optional quiet footnote keeps any honest
 * caveat ("unlocks as more people join") from being oversold.
 */

const GOLD = '#e8c87c';
const TEXT_SECONDARY = '#a7b2ca';
const TEXT_MUTED = '#7f8db0';
const gold = (a: number) => hexAlpha(GOLD, a);

export type PitchBenefit = { label: string; Icon: LucideIcon };

type Props = {
  kicker: string;
  title: string;
  body: string;
  cta: string;
  onUpgrade: () => void;
  /** One-glance benefits row (omit for the compact variant). */
  benefits?: PitchBenefit[];
  /** Small line under the CTA, e.g. trial terms. */
  trial?: string;
  /** Quiet honest note at the bottom (e.g. "unlocks as more people join"). */
  footnote?: string;
};

export function PremiumPitch({
  kicker,
  title,
  body,
  cta,
  onUpgrade,
  benefits,
  trial,
  footnote,
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

  // Slow breathing glow behind the crown — the one thing that moves.
  const breathe = useSharedValue(0.55);
  useEffect(() => {
    if (reducedMotion) {
      breathe.value = 0.8;
      return;
    }
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.55, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(breathe);
  }, [reducedMotion, breathe]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: breathe.value }));

  return (
    <View style={styles.card}>
      {/* Gold halo from the top + a hairline highlight along the edge. */}
      <Animated.View pointerEvents="none" style={[styles.halo, glowStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient
              id="pitchHalo"
              cx="50"
              cy="50"
              rx="50"
              ry="50"
              fx="50"
              fy="50"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={GOLD} stopOpacity={0.34} />
              <Stop offset="55%" stopColor={GOLD} stopOpacity={0.1} />
              <Stop offset="100%" stopColor={GOLD} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#pitchHalo)" />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={styles.edgeLine}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="pitchEdge" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={GOLD} stopOpacity={0} />
              <Stop offset="0.5" stopColor={GOLD} stopOpacity={0.75} />
              <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pitchEdge)" />
        </Svg>
      </View>

      <View style={styles.crown}>
        <Crown size={26} color={GOLD} strokeWidth={2} fill={gold(0.2)} />
      </View>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      {benefits?.length ? (
        <View style={styles.benefits}>
          {benefits.map(({ label, Icon }) => (
            <View key={label} style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Icon size={17} color={GOLD} strokeWidth={2.1} />
              </View>
              <Text style={styles.benefitLabel}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <PremiumButton
        size="lg"
        onPress={onUpgrade}
        label={cta}
        style={styles.ctaSlot}
      />
      {trial ? <Text style={styles.trial}>{trial}</Text> : null}

      {footnote ? (
        <>
          <View style={styles.rule} />
          <View style={styles.footnote}>
            <Sunrise size={14} color={TEXT_MUTED} strokeWidth={2.2} />
            <Text style={styles.footnoteText}>{footnote}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: 16,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#0e1424',
    borderWidth: 1,
    borderColor: gold(0.26),
    ...Platform.select({
      web: {
        boxShadow: `0 18px 50px -18px ${gold(0.35)}`,
      },
      default: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
      },
    }),
  },
  halo: {
    position: 'absolute',
    top: -110,
    left: '50%',
    marginLeft: -170,
    width: 340,
    height: 340,
  },
  edgeLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  crown: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: gold(0.12),
    borderWidth: 1,
    borderColor: gold(0.42),
    ...Platform.select({
      web: { boxShadow: `0 0 26px ${gold(0.4)}` },
      default: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
      },
    }),
  },
  kicker: {
    marginTop: 16,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    color: GOLD,
  },
  title: {
    marginTop: 8,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#fff',
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    maxWidth: 300,
  },
  benefits: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: 22,
    paddingHorizontal: 4,
  },
  benefit: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: gold(0.1),
    borderWidth: 1,
    borderColor: gold(0.24),
  },
  benefitLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#dbe4f0',
    textAlign: 'center',
  },
  ctaSlot: {
    marginTop: 24,
  },
  trial: {
    marginTop: 11,
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  rule: {
    alignSelf: 'stretch',
    height: 1,
    marginTop: 18,
    backgroundColor: gold(0.12),
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 6,
  },
  footnoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: TEXT_MUTED,
  },
});
