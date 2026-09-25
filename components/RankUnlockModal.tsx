import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RankEmblem, rankEmblemColor } from '@/components/ranks/RankEmblem';
import { toRank, type Rank } from '@/constants/rankLadder';
import { RANK_LADDER } from '@/shared/ranks';
import { hapticCelebrate, hapticCommit, hapticRankPeak } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * Full-screen celebration modal shown after resolve-craving returns
 * one or more `newly_unlocked_ranks`. Ranks are queued — the modal
 * cycles through them one at a time so users who cross two
 * thresholds in a single resolve see two distinct celebrations
 * instead of one that mashes the labels together.
 *
 * The celebration SCALES with how rare the rank is (`tierFor`):
 *
 *   - light   (order 1-3: First Step, Steady) — a compact card that
 *             slides up from the bottom and auto-dismisses. These
 *             come fast, early and often; a full-screen takeover on
 *             every one would nag. Single medium haptic, no confetti.
 *   - standard (order 4-6: Ridge, Foothold, Vantage) — the classic
 *             full-screen card with the emblem, a particle burst and
 *             a success haptic. Earned over days/weeks.
 *   - peak    (order 7-9: Master, Expert, Free) — bigger emblem,
 *             denser two-tone burst, a heavier haptic crescendo and a
 *             Share button. These are brag-worthy milestones; Free
 *             (the final rank) also gets its own "FINAL RANK" kicker.
 *
 * The "confetti" is a lightweight Reanimated particle burst — a
 * handful of coloured dots floating outward from the badge — to
 * avoid pulling in a native confetti library just for a flourish.
 *
 * Dismissable by tapping Continue or the backdrop; the light tier
 * also auto-dismisses after a short beat.
 */

type Props = {
  /** Ordered list of rank ids that were just unlocked. Empty = no
   *  modal is shown; consumers can safely pass whatever the Edge
   *  Function returned. */
  queue: string[];
  /** Accent colour from the addiction that produced this unlock —
   *  keeps the celebration on-brand for the trigger addiction. */
  accentColor: string;
  /** Called after every rank in the queue has been dismissed. */
  onDone: () => void;
};

type Tier = 'light' | 'standard' | 'peak';

/** Maps a rank's ladder order to its celebration intensity. */
function tierFor(order: number): Tier {
  if (order <= 3) return 'light';
  if (order <= 6) return 'standard';
  return 'peak';
}

/** Highest rank in the ladder — earns the "final rank" treatment. */
const FINAL_ORDER = RANK_LADDER.reduce((m, r) => Math.max(m, r.order), 0);

const LIGHT_DISMISS_MS = 2600;

export function RankUnlockModal({ queue, accentColor, onDone }: Props) {
  // Index of the rank currently being celebrated within the queue.
  // -1 means the modal is closed.
  const [index, setIndex] = useState<number>(queue.length > 0 ? 0 : -1);

  // Whenever a new queue lands (fresh unlock batch), reset to the
  // start. The old queue's dismissals have already fired onDone via
  // the effect that runs when index goes out of range.
  useEffect(() => {
    if (queue.length === 0) {
      setIndex(-1);
    } else {
      setIndex(0);
    }
  }, [queue]);

  const rankId = index >= 0 && index < queue.length ? queue[index] : null;

  const rankRow = rankId
    ? (RANK_LADDER.find((r) => r.id === rankId) ?? null)
    : null;
  const tier = rankRow ? tierFor(rankRow.order) : 'standard';

  // Fire haptic once per new rank celebration — the weight tracks the
  // tier so a rare rank feels physically bigger than a frequent one.
  // Keyed on rankId so consecutive unlocks each get their own beat.
  useEffect(() => {
    if (!rankId) return;
    if (tier === 'light') hapticCommit();
    else if (tier === 'peak') hapticRankPeak();
    else hapticCelebrate();
  }, [rankId, tier]);

  const dismiss = useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      if (next >= queue.length) {
        // Ran off the end — signal completion on next tick so React
        // can commit the unmount before the caller clears its
        // parent state.
        queueMicrotask(onDone);
        return -1;
      }
      return next;
    });
  }, [queue.length, onDone]);

  if (!rankId || !rankRow) return null;
  const rank = toRank(rankRow);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      {tier === 'light' ? (
        <LightCelebration rank={rank} onDismiss={dismiss} />
      ) : (
        <FullCelebration
          rank={rank}
          tier={tier}
          accentColor={accentColor}
          onDismiss={dismiss}
        />
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Light tier — compact bottom card, auto-dismisses                    */
/* ------------------------------------------------------------------ */

function LightCelebration({
  rank,
  onDismiss,
}: {
  rank: Rank;
  onDismiss: () => void;
}) {
  const y = useSharedValue(40);
  const opacity = useSharedValue(0);
  const color = rankEmblemColor(rank.order - 1);

  useEffect(() => {
    y.value = withTiming(0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, { duration: 260 });
    const timer = setTimeout(onDismiss, LIGHT_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [y, opacity, onDismiss]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <Pressable style={styles.lightBackdrop} onPress={onDismiss}>
      <Animated.View style={[styles.lightCard, animStyle]}>
        <View style={[styles.lightBadge, { shadowColor: color }]}>
          <RankEmblem tier={rank.order - 1} size={48} />
        </View>
        <View style={styles.lightText}>
          <Text style={styles.lightKicker}>{t('celebration.kicker')}</Text>
          <Text style={[styles.lightName, { color }]} numberOfLines={1}>
            {rank.name}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Standard + peak tiers — full-screen card                            */
/* ------------------------------------------------------------------ */

function FullCelebration({
  rank,
  tier,
  accentColor,
  onDismiss,
}: {
  rank: Rank;
  tier: Tier;
  accentColor: string;
  onDismiss: () => void;
}) {
  const peak = tier === 'peak';
  const isFinal = peak && rank.order === FINAL_ORDER;
  const color = rankEmblemColor(rank.order - 1);

  const onShare = useCallback(() => {
    Share.share({
      message: t('celebration.share_message', { rank: rank.name }),
    }).catch(() => {});
  }, [rank.name]);

  const kicker = isFinal
    ? t('celebration.final_kicker')
    : peak
      ? t('celebration.peak_kicker')
      : t('celebration.kicker');

  return (
    <Pressable style={styles.backdrop} onPress={onDismiss}>
      {/* stopPropagation via inner Pressable — tapping the content
          card itself shouldn't dismiss; only the backdrop or a
          button should. */}
      <Pressable
        style={styles.card}
        onPress={(e) => {
          (
            e as unknown as { stopPropagation?: () => void }
          )?.stopPropagation?.();
        }}
      >
        <View style={styles.badgeArea}>
          {/* Behind the badge: particle burst — denser + two-tone at
              the peak tier so the rare ranks read bigger. */}
          <ParticleBurst
            accentColor={accentColor}
            secondaryColor={color}
            count={peak ? 26 : 14}
            spread={peak ? 108 : 78}
            twoTone={peak}
          />
          <View
            style={[
              styles.badge,
              { shadowColor: accentColor, shadowRadius: peak ? 28 : 20 },
            ]}
          >
            <RankEmblem
              tier={rank.order - 1}
              size={peak ? 128 : 112}
              haloBoost={peak ? 1.35 : 1}
            />
          </View>
        </View>

        <Text style={styles.kicker}>{kicker}</Text>
        {/* Rank names wear the rank's own colour everywhere — the
            addiction accent stays on the burst and the glow. */}
        <Text style={[styles.rankName, { color }]}>{rank.name}</Text>
        <Text style={styles.rankDescription}>{rank.description}</Text>

        <View style={styles.actions}>
          {peak ? (
            <Pressable
              style={[
                styles.shareBtn,
                { borderColor: color, backgroundColor: hexAlpha(color, 0.16) },
              ]}
              onPress={onShare}
            >
              <Text style={[styles.shareText, { color }]}>
                {t('celebration.share')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[
              styles.continueBtn,
              {
                borderColor: accentColor,
                backgroundColor: hexAlpha(accentColor, 0.16),
              },
            ]}
            onPress={onDismiss}
          >
            <Text style={[styles.continueText, { color: accentColor }]}>
              {t('celebration.continue')}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

/**
 * Lightweight "confetti" — small circles that ease out from the
 * badge centre and fade. Cheap to render, no external dep. Runs
 * once per mount; a new mount happens each queue step because the
 * key on the parent Modal effectively toggles.
 */
function ParticleBurst({
  accentColor,
  secondaryColor,
  count,
  spread,
  twoTone,
}: {
  accentColor: string;
  secondaryColor: string;
  count: number;
  spread: number;
  twoTone: boolean;
}) {
  const particles = Array.from({ length: count }, (_, i) => i);
  return (
    <View pointerEvents="none" style={styles.particleWrap}>
      {particles.map((i) => (
        <Particle
          key={i}
          index={i}
          count={count}
          spread={spread}
          color={twoTone && i % 2 === 1 ? secondaryColor : accentColor}
        />
      ))}
    </View>
  );
}

function Particle({
  index,
  count,
  spread,
  color,
}: {
  index: number;
  count: number;
  spread: number;
  color: string;
}) {
  // Deterministic angle so each particle heads a different direction
  // but the same overall bloom shape every time.
  const angle = (index / count) * Math.PI * 2;
  const distance = spread + (index % 3) * 12;
  const targetX = Math.cos(angle) * distance;
  const targetY = Math.sin(angle) * distance;

  const t = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(200, withTiming(0, { duration: 500 }))
    );
  }, [t, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: t.value * targetX },
      { translateY: t.value * targetY },
      { scale: 0.5 + t.value * 0.6 },
    ],
  }));

  return (
    <Animated.View
      style={[styles.particle, { backgroundColor: color }, animStyle]}
    />
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0A1628',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    padding: 28,
    alignItems: 'center',
    boxShadow:
      '0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  badgeArea: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleWrap: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    // No border or fill any more: the emblem brings its own frame,
    // and a ring around it read as two competing frames. The glow
    // stays so the burst behind it still has something to sit on.
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 8,
  },
  kicker: {
    marginTop: 4,
    color: '#6B8BA4',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
  rankName: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  rankDescription: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtn: {
    height: 48,
    minWidth: 160,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  shareBtn: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  /* Light tier */
  lightBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.35)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  lightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#0A1628',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    paddingVertical: 14,
    paddingHorizontal: 16,
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
  },
  lightBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  lightText: {
    flex: 1,
  },
  lightKicker: {
    color: '#6B8BA4',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  lightName: {
    marginTop: 3,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
