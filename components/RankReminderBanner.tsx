import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RankEmblem, rankEmblemColor } from '@/components/ranks/RankEmblem';
import { toRank } from '@/constants/rankLadder';
import { RANK_LADDER } from '@/shared/ranks';
import { t } from '@/lib/i18n';

/**
 * Top reminder banner — the "in case you missed it" companion to the
 * full-screen celebration. When a rank is crossed mid-session it is
 * stashed (lib/rankReminders); the home screen drains that queue on
 * launch and hands the ids here. Each one slides DOWN from the top,
 * holds briefly, then retracts — a gentle "you're now <rank>" nudge,
 * not a takeover. Tapping it dismisses early.
 *
 * Cycles one rank at a time so two banked unlocks each get their own
 * beat, mirroring the modal's queue behaviour.
 */

type Props = {
  /** Rank ids to remind about, in order. Empty = nothing shown. */
  queue: string[];
  /** Called once every reminder in the queue has been shown. */
  onDone: () => void;
};

const HOLD_MS = 2800;

export function RankReminderBanner({ queue, onDone }: Props) {
  const [index, setIndex] = useState<number>(queue.length > 0 ? 0 : -1);

  useEffect(() => {
    setIndex(queue.length === 0 ? -1 : 0);
  }, [queue]);

  const rankId = index >= 0 && index < queue.length ? queue[index] : null;
  const rankRow = rankId
    ? (RANK_LADDER.find((r) => r.id === rankId) ?? null)
    : null;

  const advance = useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      if (next >= queue.length) {
        queueMicrotask(onDone);
        return -1;
      }
      return next;
    });
  }, [queue.length, onDone]);

  if (!rankId || !rankRow) return null;
  const rank = toRank(rankRow);

  return (
    <BannerCard
      key={rankId}
      name={rank.name}
      tier={rank.order - 1}
      onDismiss={advance}
    />
  );
}

function BannerCard({
  name,
  tier,
  onDismiss,
}: {
  name: string;
  tier: number;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const y = useSharedValue(-140);
  const color = rankEmblemColor(tier);

  useEffect(() => {
    y.value = withTiming(0, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
    const hold = setTimeout(() => {
      y.value = withTiming(-160, {
        duration: 300,
        easing: Easing.in(Easing.cubic),
      });
    }, HOLD_MS);
    const gone = setTimeout(onDismiss, HOLD_MS + 320);
    return () => {
      clearTimeout(hold);
      clearTimeout(gone);
    };
  }, [y, onDismiss]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return (
    <View
      style={[styles.wrap, { paddingTop: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <Animated.View style={animStyle}>
        <Pressable style={styles.card} onPress={onDismiss}>
          <View style={[styles.badge, { shadowColor: color }]}>
            <RankEmblem tier={tier} size={40} />
          </View>
          <View style={styles.text}>
            <Text style={styles.kicker}>
              {t('celebration.reminder_kicker')}
            </Text>
            <Text style={[styles.name, { color }]} numberOfLines={1}>
              {name}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 50,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(12, 20, 38, 0.96)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    paddingVertical: 12,
    paddingHorizontal: 14,
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  text: {
    flex: 1,
  },
  kicker: {
    color: '#6B8BA4',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  name: {
    marginTop: 3,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
