import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { toRank } from '@/constants/rankLadder';
import { RANK_LADDER } from '@/shared/ranks';
import { hapticCelebrate } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * Full-screen celebration modal shown after resolve-craving returns
 * one or more `newly_unlocked_ranks`. Ranks are queued — the modal
 * cycles through them one at a time so users who cross two
 * thresholds in a single resolve see two distinct celebrations
 * instead of one that mashes the labels together.
 *
 * Heavy haptic fires on each new rank. The "confetti" here is a
 * lightweight Reanimated particle burst — a handful of coloured
 * dots that float outward from the badge — to avoid pulling in a
 * native confetti library just for a one-off flourish.
 *
 * Dismissable by tapping the Continue button or the backdrop.
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

const NUM_PARTICLES = 14;

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

  // Fire haptic once per new rank celebration — feels physical, not
  // decorative. Effect intentionally keyed on rankId so consecutive
  // unlocks each get a beat.
  useEffect(() => {
    if (rankId) hapticCelebrate();
  }, [rankId]);

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

  if (!rankId) return null;

  const rankRow = RANK_LADDER.find((r) => r.id === rankId);
  if (!rankRow) return null;
  const rank = toRank(rankRow);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        {/* stopPropagation via inner Pressable — tapping the content
            card itself shouldn't dismiss; only the backdrop or
            Continue button should. */}
        <Pressable
          style={styles.card}
          onPress={(e) => {
            (
              e as unknown as { stopPropagation?: () => void }
            )?.stopPropagation?.();
          }}
        >
          <View style={styles.badgeArea}>
            {/* Behind the badge: soft particle burst */}
            <ParticleBurst accentColor={accentColor} />
            <View
              style={[
                styles.badge,
                {
                  borderColor: accentColor,
                  backgroundColor: hexAlpha(accentColor, 0.18),
                  shadowColor: accentColor,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: accentColor }]}>
                {rank.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.kicker}>{t('celebration.kicker')}</Text>
          <Text style={[styles.rankName, { color: accentColor }]}>
            {rank.name}
          </Text>
          <Text style={styles.rankDescription}>{rank.description}</Text>

          <Pressable
            style={[
              styles.continueBtn,
              {
                borderColor: accentColor,
                backgroundColor: hexAlpha(accentColor, 0.16),
              },
            ]}
            onPress={dismiss}
          >
            <Text style={[styles.continueText, { color: accentColor }]}>
              {t('celebration.continue')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Lightweight "confetti" — small circles that ease out from the
 * badge centre and fade. Cheap to render, no external dep. Runs
 * once per mount; a new mount happens each queue step because the
 * key on the parent Modal effectively toggles.
 */
function ParticleBurst({ accentColor }: { accentColor: string }) {
  const particles = Array.from({ length: NUM_PARTICLES }, (_, i) => i);
  return (
    <View pointerEvents="none" style={styles.particleWrap}>
      {particles.map((i) => (
        <Particle key={i} index={i} accentColor={accentColor} />
      ))}
    </View>
  );
}

function Particle({
  index,
  accentColor,
}: {
  index: number;
  accentColor: string;
}) {
  // Deterministic angle so each particle heads a different direction
  // but the same overall bloom shape every time.
  const angle = (index / NUM_PARTICLES) * Math.PI * 2;
  const distance = 78 + (index % 3) * 12;
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
      style={[styles.particle, { backgroundColor: accentColor }, animStyle]}
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
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 8,
  },
  badgeText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
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
  continueBtn: {
    marginTop: 24,
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
});
