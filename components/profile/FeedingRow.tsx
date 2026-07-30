import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { lucideIconFor } from '@/components/info/iconMap';
import { rankEmblemColor } from '@/components/ranks/RankEmblem';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';
import {
  CORE_ANIM,
  coreDivider,
  coreRadius,
  coreText,
  hexAlpha,
} from './coreTheme';

/**
 * One "FEEDING THE CORE" row.
 *
 * No card — a hairline-separated row, because the addictions are a
 * *list of contributors* to a single thing (the core), not four
 * independent objects. The visual weight lives in the contribution
 * bar, whose width is the addiction's share of the *top* score, not a
 * percentage of some total: the leader always fills the track, and the
 * others read as "how far behind" at a glance.
 */

let gradSeq = 0;

type Props = {
  addiction: Addiction;
  rankName: string;
  /** 1-based ladder position — drives the rank name's fixed colour. */
  rankOrder: number;
  score: number;
  /** Highest score across the list — the bar's 100% reference. */
  maxScore: number;
  index: number;
  showDivider: boolean;
  onPress: () => void;
};

export function FeedingRow({
  addiction,
  rankName,
  rankOrder,
  score,
  maxScore,
  index,
  showDivider,
  onPress,
}: Props) {
  const reduced = useReducedMotion();
  const hue = addiction.color;
  const share = maxScore > 0 ? Math.max(0.04, score / maxScore) : 0;

  const w = useSharedValue(reduced ? share : 0);

  useEffect(() => {
    if (reduced) {
      w.value = share;
      return;
    }
    w.value = withDelay(
      CORE_ANIM.barDelayMs + index * CORE_ANIM.rowStaggerMs,
      withTiming(share, {
        duration: CORE_ANIM.barFillMs,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [index, reduced, share, w]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${w.value * 100}%`,
  }));

  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${addiction.name} — ${rankName}, ${score}`}
      >
        <IconSquare hue={hue} addictionId={addiction.id} />

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {addiction.name}
          </Text>
          <View style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  backgroundColor: hue,
                  ...Platform.select({
                    web: { boxShadow: `0 0 7px ${hexAlpha(hue, 0.5)}` },
                    default: {
                      shadowColor: hue,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.6,
                      shadowRadius: 4,
                    },
                  }),
                },
                barStyle,
              ]}
            />
          </View>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaText} numberOfLines={1}>
            {/* Rank colour comes from the RANK, not the addiction —
                "Base" used to render in four different accents down
                this list, which read as four different things. */}
            <Text style={{ color: rankEmblemColor(rankOrder - 1) }}>
              {rankName}
            </Text>
            <Text style={styles.metaDot}> · </Text>
            {score.toLocaleString('en-US')}
          </Text>
        </View>

        <ChevronRight size={16} color={coreText.tertiary} strokeWidth={2} />
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

/** 34px tile carrying the addiction's own hue as a soft radial bloom. */
function IconSquare({
  hue,
  addictionId,
}: {
  hue: string;
  addictionId: string;
}) {
  // `useId()` emits `:r0:`, which is not a legal SVG id and silently
  // breaks `url(#…)` on web — hence the module-level counter.
  const id = `feedGrad${(gradSeq += 1)}`;
  // The designed glyph set, not the platform emoji — same map the
  // Addictions tab draws its cards with.
  const Icon = lucideIconFor(addictionId);
  return (
    <View style={[styles.iconSquare, { borderColor: hexAlpha(hue, 0.34) }]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="35%" r="70%">
            <Stop offset="0%" stopColor={hue} stopOpacity={0.34} />
            <Stop offset="100%" stopColor={hue} stopOpacity={0.06} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="70" fill={`url(#${id})`} />
      </Svg>
      <Icon size={17} color={hue} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.6,
  },
  iconSquare: {
    width: 34,
    height: 34,
    borderRadius: coreRadius.iconSquare,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    gap: 7,
  },
  name: {
    color: coreText.strong,
    fontSize: 14,
    fontWeight: '700',
  },
  barTrack: {
    height: 4,
    borderRadius: coreRadius.bar,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: coreRadius.bar,
  },
  meta: {
    maxWidth: 110,
  },
  metaText: {
    color: coreText.secondary,
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  metaDot: {
    color: coreText.tertiary,
  },
  divider: {
    height: 1,
    backgroundColor: coreDivider,
    // 34px tile + 12px gap — the divider starts under the text, not
    // under the icon, so the icons read as a column.
    marginLeft: 46,
  },
});
