import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
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
import {
  ArrowRight,
  ChartNoAxesColumn,
  Clock,
  Crown,
  Sunrise,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { compColors, compHexAlpha } from './comparisonTheme';

/**
 * Premium pitch for the Comparison tab's launch state (free users).
 *
 * Replaces the flat "lookout before sunrise" card as the thing that sits
 * above the blurred previews. It wears the paywall's gold identity (same
 * GOLD + Crown as `app/paywall.tsx`) so the tap into the paywall feels
 * like a continuation, not a jump: gilded halo, a slow "breathing" glow
 * on the crown, three one-glance benefits, and a gold CTA. The honest
 * launch note ("comparisons unlock as more people join") stays, demoted
 * to a quiet footnote so nothing is oversold.
 */

const GOLD = '#e8c87c';
const GOLD_DEEP = '#d9b45a';
const gold = (a: number) => compHexAlpha(GOLD, a);

const BENEFITS: { key: string; Icon: LucideIcon }[] = [
  { key: 'comparison.pitch_f1', Icon: Trophy },
  { key: 'comparison.pitch_f2', Icon: ChartNoAxesColumn },
  { key: 'comparison.pitch_f3', Icon: Clock },
];

type Props = {
  addiction: Addiction;
  onUpgrade: () => void;
};

export function PremiumPitch({ addiction, onUpgrade }: Props) {
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
      <Text style={styles.kicker}>{t('comparison.pitch_kicker')}</Text>
      <Text style={styles.title}>{t('comparison.free_title')}</Text>
      <Text style={styles.body}>
        {t('comparison.free_body', { addiction: addiction.name })}
      </Text>

      <View style={styles.benefits}>
        {BENEFITS.map(({ key, Icon }) => (
          <View key={key} style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Icon size={17} color={GOLD} strokeWidth={2.1} />
            </View>
            <Text style={styles.benefitLabel}>{t(key)}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onUpgrade}
        accessibilityRole="button"
        accessibilityLabel={t('comparison.free_cta')}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="pitchCta" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#f6e2a6" />
              <Stop offset="1" stopColor={GOLD_DEEP} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pitchCta)" />
        </Svg>
        <Text style={styles.ctaText}>{t('comparison.free_cta')}</Text>
        <ArrowRight size={18} color="#2a1f06" strokeWidth={2.6} />
      </Pressable>
      <Text style={styles.trial}>{t('comparison.pitch_trial')}</Text>

      <View style={styles.rule} />
      <View style={styles.footnote}>
        <Sunrise size={14} color={compColors.textMuted} strokeWidth={2.2} />
        <Text style={styles.footnoteText}>{t('comparison.launch_body')}</Text>
      </View>
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
    color: compColors.textSecondary,
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
  cta: {
    alignSelf: 'stretch',
    marginTop: 24,
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      web: { boxShadow: `0 10px 28px -8px ${gold(0.6)}` },
      default: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
      },
    }),
  },
  ctaPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  ctaText: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#2a1f06',
  },
  trial: {
    marginTop: 11,
    fontSize: 12,
    fontWeight: '600',
    color: compColors.textMuted,
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
    color: compColors.textMuted,
  },
});
