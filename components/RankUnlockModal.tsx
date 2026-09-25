import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { RankEmblem, rankEmblemColor } from '@/components/ranks/RankEmblem';
import { toRank, type Rank } from '@/constants/rankLadder';
import { RANK_LADDER } from '@/shared/ranks';
import { hapticCelebrate, hapticRankPeak } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * Full-screen celebration modal shown after resolve-craving returns
 * one or more `newly_unlocked_ranks`. Ranks are queued — the modal
 * cycles through them one at a time so users who cross two thresholds
 * in a single resolve see two distinct celebrations.
 *
 * ONE interface for every rank (no per-tier layout split). What scales
 * with the rank instead is the LIGHT: a soft radial glow that grows in
 * behind the emblem and blurred light rays that slowly turn. The higher the
 * rank, the brighter the glow, the more rays and the faster they turn —
 * so crossing the ninth rank plainly feels bigger than the second
 * without a different screen. Deliberately restrained: a grow, a slow
 * turn, a gentle pulse — no particle confetti.
 *
 * The turn + pulse run on the Reanimated UI thread (native driver),
 * so the continuous motion stays cheap. NOTE (perf): still worth an
 * eyeball on a low-end Android — an always-rotating SVG plus the app's
 * own background is the heaviest this screen gets.
 *
 * Dismissable by tapping Continue or the backdrop.
 */

type Props = {
  /** Ordered list of rank ids that were just unlocked. Empty = no
   *  modal is shown. */
  queue: string[];
  /** Called after every rank in the queue has been dismissed. */
  onDone: () => void;
};

/** Highest rank order in the ladder — the "final rank". */
const FINAL_ORDER = RANK_LADDER.reduce((m, r) => Math.max(m, r.order), 0);

/** 0 at the first unlockable rank → 1 at the final rank. */
function intensityFor(order: number): number {
  if (FINAL_ORDER <= 1) return 1;
  return Math.max(0, Math.min(1, (order - 1) / (FINAL_ORDER - 1)));
}

/** Dark or light body text for a filled swatch, by perceived luminance.
 *  Keeps the Continue label readable across all nine gem colours. */
function readableTextOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0A1220' : '#ffffff';
}

export function RankUnlockModal({ queue, onDone }: Props) {
  // Index of the rank currently being celebrated. -1 = closed.
  const [index, setIndex] = useState<number>(queue.length > 0 ? 0 : -1);

  useEffect(() => {
    setIndex(queue.length === 0 ? -1 : 0);
  }, [queue]);

  const rankId = index >= 0 && index < queue.length ? queue[index] : null;
  const rankRow = rankId
    ? (RANK_LADDER.find((r) => r.id === rankId) ?? null)
    : null;

  // Haptic once per rank — heavier crescendo for the rare high ranks.
  useEffect(() => {
    if (!rankRow) return;
    if (rankRow.order >= 6) hapticRankPeak();
    else hapticCelebrate();
  }, [rankRow]);

  const dismiss = useCallback(() => {
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
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Celebration rank={rank} onDismiss={dismiss} />
    </Modal>
  );
}

function Celebration({
  rank,
  onDismiss,
}: {
  rank: Rank;
  onDismiss: () => void;
}) {
  const intensity = intensityFor(rank.order);
  const isFinal = rank.order === FINAL_ORDER;
  const color = rankEmblemColor(rank.order - 1);
  const onColor = readableTextOn(color);

  const kicker = isFinal
    ? t('celebration.final_kicker')
    : t('celebration.kicker');

  return (
    <Pressable style={styles.backdrop} onPress={onDismiss}>
      {/* stopPropagation — tapping the card itself shouldn't dismiss. */}
      <Pressable
        style={styles.card}
        onPress={(e) => {
          (
            e as unknown as { stopPropagation?: () => void }
          )?.stopPropagation?.();
        }}
      >
        <View style={styles.badgeArea}>
          <RankHalo color={color} intensity={intensity} />
          <View style={styles.badge}>
            <RankEmblem
              tier={rank.order - 1}
              size={240}
              haloBoost={1 + intensity * 0.4}
            />
          </View>
        </View>

        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={[styles.rankName, { color }]}>{rank.name}</Text>
        <Text style={styles.rankDescription}>{rank.description}</Text>

        <Pressable
          style={({ pressed }) => [
            styles.continueBtn,
            { backgroundColor: color },
            pressed && styles.continuePressed,
          ]}
          onPress={onDismiss}
        >
          <Text style={[styles.continueText, { color: onColor }]}>
            {t('celebration.continue')}
          </Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

/**
 * The celebration's only motion: soft light rays fanning out from
 * behind the emblem and slowly turning, over a radial glow that grows
 * in and breathes. The rays are blurred (Gaussian) so they read as
 * light, not as geometry, and fade to nothing toward their tips.
 * Everything scales with `intensity` (0 → early rank, 1 → final rank):
 * more rays, a brighter glow, a faster turn, and — from the mid ranks
 * up — a second layer of rays counter-rotating behind the first.
 *
 * The blur is rasterised once by the SVG; the continuous motion is
 * just a rotate transform on the UI thread, so it stays cheap.
 */
const HALO_SIZE = 340;

/** A fan of narrow tapered wedges from the centre out to the edge. */
function rayPath(
  cx: number,
  cy: number,
  r: number,
  angle: number,
  half: number
) {
  const a1 = angle - half;
  const a2 = angle + half;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r;
  const y2 = cy + Math.sin(a2) * r;
  return `M${cx} ${cy}L${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}Z`;
}

function RayLayer({
  color,
  count,
  id,
  offset,
  strength,
}: {
  color: string;
  count: number;
  id: string;
  offset: number;
  strength: number;
}) {
  const C = HALO_SIZE / 2;
  return (
    <Svg width={HALO_SIZE} height={HALO_SIZE}>
      <Defs>
        <RadialGradient
          id={`${id}Fade`}
          cx={C}
          cy={C}
          r={C}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={color} stopOpacity={0.7 * strength} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.28 * strength} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        <Filter id={`${id}Blur`} x="-20%" y="-20%" width="140%" height="140%">
          <FeGaussianBlur stdDeviation="5" />
        </Filter>
      </Defs>
      <G filter={`url(#${id}Blur)`}>
        {Array.from({ length: count }, (_, i) => {
          const angle = offset + (i / count) * Math.PI * 2;
          // Alternate wide / narrow so the fan doesn't look mechanical.
          const half = (i % 2 === 0 ? 0.11 : 0.06) * (6 / count + 0.5);
          return (
            <Path
              key={i}
              d={rayPath(C, C, C, angle, half)}
              fill={`url(#${id}Fade)`}
            />
          );
        })}
      </G>
    </Svg>
  );
}

function RankHalo({ color, intensity }: { color: string; intensity: number }) {
  const rays = 8 + Math.round(intensity * 6); // 8 → 14
  const turnMs = 16000 - intensity * 7000; // faster at higher ranks

  const grow = useSharedValue(0);
  const spin = useSharedValue(0);
  const spin2 = useSharedValue(0);

  useEffect(() => {
    grow.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    spin.value = withRepeat(
      withTiming(360, { duration: turnMs, easing: Easing.linear }),
      -1
    );
    spin2.value = withRepeat(
      withTiming(360, { duration: turnMs * 1.5, easing: Easing.linear }),
      -1
    );
  }, [grow, spin, spin2, turnMs]);

  const glowStyle = useAnimatedStyle(() => {
    // Grow-in, then a very gentle breathing pulse.
    const pulse = 1 + 0.04 * Math.sin(spin.value * (Math.PI / 180) * 3);
    return {
      opacity: grow.value,
      transform: [{ scale: (0.7 + grow.value * 0.3) * pulse }],
    };
  });
  const spinStyle = useAnimatedStyle(() => ({
    opacity: grow.value,
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const spin2Style = useAnimatedStyle(() => ({
    opacity: grow.value * 0.75,
    transform: [{ rotate: `${-spin2.value}deg` }],
  }));

  const glowOpacity = 0.5 + intensity * 0.4;

  return (
    <View style={styles.haloWrap} pointerEvents="none">
      {/* Growing radial glow */}
      <Animated.View style={[styles.haloLayer, glowStyle]}>
        <Svg width={HALO_SIZE} height={HALO_SIZE}>
          <Defs>
            <RadialGradient id="rankGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color} stopOpacity={glowOpacity} />
              <Stop
                offset="0.5"
                stopColor={color}
                stopOpacity={glowOpacity * 0.35}
              />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={HALO_SIZE / 2}
            cy={HALO_SIZE / 2}
            r={HALO_SIZE / 2}
            fill="url(#rankGlow)"
          />
        </Svg>
      </Animated.View>

      {/* Counter-rotating back layer — mid ranks and up. */}
      {intensity > 0.4 ? (
        <Animated.View style={[styles.haloLayer, spin2Style]}>
          <RayLayer
            color={color}
            count={Math.max(6, rays - 2)}
            id="rankRaysB"
            offset={Math.PI / rays}
            strength={0.7}
          />
        </Animated.View>
      ) : null}

      {/* Main rays */}
      <Animated.View style={[styles.haloLayer, spinStyle]}>
        <RayLayer
          color={color}
          count={rays}
          id="rankRaysA"
          offset={0}
          strength={0.85 + intensity * 0.15}
        />
      </Animated.View>
    </View>
  );
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
    boxShadow:
      '0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  badgeArea: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloLayer: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    marginTop: 2,
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
    marginTop: 26,
    height: 52,
    minWidth: 200,
    paddingHorizontal: 28,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 22px -8px rgba(0,0,0,0.7)',
  },
  continuePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  continueText: {
    color: '#0A1220',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
