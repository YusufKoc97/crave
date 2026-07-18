import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { RANK_LADDER } from '@/constants/rankLadder';
import type { JourneyView } from '@/context/AddictionScoresContext';
import { t } from '@/lib/i18n';
import {
  dsColors,
  dsFont,
  dsRadius,
  dsSectionHeaderStyle,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';

/**
 * Journey view for Module 1 — hero rank card at top, vertical
 * ladder underneath. Design refresh (Journey redesign):
 *
 *   Hero card layout is now score-ring-left / rank-right:
 *   ┌─────────────────────────────────────────────┐
 *   │  ╭───╮   YOUR RANK                          │
 *   │  │40 │   Traveler                           │
 *   │  ╰───╯   Your journey begins                │
 *   │                                             │
 *   │  ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
 *   │           60 more to First Step             │
 *   └─────────────────────────────────────────────┘
 *
 *   - Score sits INSIDE a mini progress ring (78×78 SVG) that
 *     tracks progressWithinRank — same data as the bar below,
 *     restated as a visual so the "score" reads as journey-in-
 *     progress rather than a static number.
 *   - Right column: YOUR RANK caps + big rank name + per-rank
 *     blurb (comes from rank.description).
 *   - Full-width bar underneath with a Reanimated sheen that
 *     sweeps left→right on a 3.4s loop.
 *   - Container gains an accent-tinted radial wash (web) and
 *     an accent-color halo shadow.
 *
 *   Vertical ladder below is unchanged in this milestone; the
 *   handoff's "THE PATH" reversal + atmospheric scene lands in
 *   the next passes.
 */

type Props = {
  view: JourneyView;
  /** Color-locked accent (from the addiction catalog). */
  accentColor: string;
};

// ─── Ring geometry ────────────────────────────────────────────
const RING_BOX = 78;
const RING_RADIUS = 34;
const RING_STROKE = 6;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~213.6

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function JourneyBar({ view, accentColor }: Props) {
  const { score, currentRank, nextRank, progress, unlockedIds, unlockedAt } =
    view;

  const remaining = nextRank ? Math.max(0, nextRank.thresholdScore - score) : 0;

  // Bar fill (0..progress) — ease-in on mount.
  const barAnim = useSharedValue(0);
  useEffect(() => {
    barAnim.value = 0;
    barAnim.value = withTiming(progress, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [barAnim, progress]);
  const barFillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(barAnim.value * 100)}%`,
  }));

  // Ring arc (0..progress) — same easing; drives strokeDashoffset
  // via width transform we can't use, so we use a shared value +
  // useAnimatedProps for the SVG Circle.
  const ringAnim = useSharedValue(0);
  useEffect(() => {
    ringAnim.value = 0;
    ringAnim.value = withTiming(progress, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [ringAnim, progress]);
  // For SVG we compute the resting dashoffset from progress at
  // render time — cheap and doesn't need a Reanimated animated
  // prop for a mount-only easing. The next mount uses the same
  // technique with the new progress value.
  const ringDashOffset =
    RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));

  // Sheen — 40pt-wide white glint sweeping across the bar every 3.4s.
  // Hidden until the bar has actually filled to some value; a bar at
  // 0% has nothing worth glinting off.
  const sheenAnim = useSharedValue(-40);
  useEffect(() => {
    if (progress <= 0.02) return; // near-zero → no sheen
    sheenAnim.value = -40;
    sheenAnim.value = withRepeat(
      withTiming(1, {
        // 1 = "full width away from left edge" — mapped to a
        // container-width translateX at style time. RN doesn't
        // expose the animated node's own layout width in a worklet
        // cheaply, so we translate a normalized 0..1 value into
        // percent and let the layout engine handle the actual px.
        duration: 3400,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      false
    );
  }, [sheenAnim, progress]);
  const sheenStyle = useAnimatedStyle(() => ({
    // translate as a percentage of the bar width — RN Web + native
    // both accept percentage translateX strings.
    transform: [{ translateX: `${sheenAnim.value * 100}%` }],
  }));

  return (
    <View style={styles.root}>
      {/* ── Hero rank card ─────────────────────────────────────── */}
      <View style={[styles.heroCard, heroCardBg(accentColor)]}>
        <View style={styles.heroTopRow}>
          {/* Left — score ring */}
          <View style={styles.ringWrap}>
            <Svg
              width={RING_BOX}
              height={RING_BOX}
              viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
            >
              <Circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={hexAlpha(accentColor, 0.14)}
                strokeWidth={RING_STROKE}
              />
              <Circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={accentColor}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE}`}
                strokeDashoffset={`${ringDashOffset}`}
                transform={`rotate(-90 ${RING_BOX / 2} ${RING_BOX / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringScore}>{compactScore(score)}</Text>
              <Text style={styles.ringLabel}>{t('journey.score_label')}</Text>
            </View>
          </View>

          {/* Right — rank + blurb */}
          <View style={styles.rankCol}>
            <Text style={styles.rankKicker}>{t('journey.your_rank')}</Text>
            <Text style={styles.rankName} numberOfLines={1}>
              {currentRank.name}
            </Text>
            <Text style={styles.rankBlurb} numberOfLines={2}>
              {currentRank.description}
            </Text>
          </View>
        </View>

        {/* Full-width bar */}
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              barFillStyle,
              {
                backgroundColor: accentColor,
                shadowColor: accentColor,
              },
            ]}
          />
          {/* Sheen — a soft white glint sliding across the bar */}
          <Animated.View
            pointerEvents="none"
            style={[styles.sheen, sheenStyle]}
          />
        </View>

        <Text style={styles.nextHint}>
          {nextRank
            ? t('journey.next_rank_progress', {
                remaining,
                name: nextRank.name,
              })
            : t('journey.at_ceiling')}
        </Text>
      </View>

      {/* ── Vertical detailed ladder (unchanged this milestone) ─ */}
      <Text style={styles.ladderKicker}>{t('journey.ladder_title')}</Text>
      <View style={styles.ladderList}>
        {RANK_LADDER.map((rank) => {
          const isCurrent = rank.id === currentRank.id;
          const isUnlocked = unlockedIds.has(rank.id);
          const isFuture = !isUnlocked && !isCurrent;
          const unlockedIso = unlockedAt.get(rank.id);
          const statusLabel = isCurrent
            ? t('journey.current')
            : isUnlocked
              ? unlockedIso
                ? t('journey.unlocked_at', { date: formatDate(unlockedIso) })
                : t('journey.unlocked')
              : `${rank.thresholdScore} pts`;
          return (
            <View
              key={rank.id}
              style={[
                styles.ladderRow,
                isCurrent && {
                  borderColor: accentColor,
                  backgroundColor: hexAlpha(accentColor, 0.08),
                },
                isFuture && styles.ladderRowFuture,
              ]}
            >
              <View
                style={[
                  styles.markerDot,
                  isUnlocked || isCurrent
                    ? {
                        backgroundColor: accentColor,
                        borderColor: accentColor,
                        shadowColor: accentColor,
                      }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: dsColors.textTertiary,
                      },
                  isCurrent && styles.markerDotCurrent,
                ]}
              />
              <View style={styles.ladderText}>
                <Text
                  style={[
                    styles.ladderName,
                    isFuture && styles.ladderNameFuture,
                  ]}
                  numberOfLines={1}
                >
                  {rank.name}
                </Text>
                <Text style={styles.ladderStatus}>{statusLabel}</Text>
              </View>
              <Text
                style={[
                  styles.ladderThreshold,
                  isFuture && styles.ladderThresholdFuture,
                ]}
              >
                {rank.thresholdScore}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** 12000+ scores overflow the ring — abbreviate as k. */
function compactScore(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}k`;
  return `${n}`;
}

/** Hero container gradient + border tint. Web gets a real radial
 *  wash from the accent color; native uses the same solid bg
 *  plus shadow to approximate the "lit from above" feel. */
function heroCardBg(accent: string) {
  const base = {
    borderColor: hexAlpha(accent, 0.28),
    shadowColor: accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 6,
    backgroundColor: '#141d2e',
  };
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webBg: any = {
      backgroundImage: `radial-gradient(120% 110% at 100% 0%, ${hexAlpha(accent, 0.14)}, transparent 55%), linear-gradient(160deg, #141d2e, #0b1220)`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 14px 30px -16px ${hexAlpha(accent, 0.3)}`,
    };
    return { ...base, ...webBg };
  }
  return base;
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: dsSpacing.xl,
    paddingBottom: dsSpacing.x4l,
  },
  heroCard: {
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 18,
  },
  ringWrap: {
    width: RING_BOX,
    height: RING_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringScore: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
  },
  ringLabel: {
    marginTop: 2,
    color: '#7f93b3',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  rankCol: {
    flex: 1,
    minWidth: 0,
  },
  rankKicker: {
    color: '#7f93b3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rankName: {
    color: '#f4f7fc',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 34,
    marginBottom: 4,
  },
  rankBlurb: {
    color: '#8397b6',
    fontSize: 13,
    lineHeight: 18,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 40,
    backgroundColor: 'rgba(255,255,255,0.35)',
    // Soft edges so it reads as a glint, not a bar.
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
        backgroundColor: 'transparent',
      } as never,
      default: {
        opacity: 0.6,
      },
    }),
  },
  nextHint: {
    marginTop: 12,
    color: '#8aa0c4',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  ladderKicker: {
    ...dsSectionHeaderStyle,
    paddingHorizontal: 2,
  },
  ladderList: {
    // Rows self-style — no wrapper.
  },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.md,
    height: 64,
    paddingHorizontal: dsSpacing.lg,
    borderRadius: dsRadius.card,
    backgroundColor: dsColors.cardSurface,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    marginBottom: dsSpacing.sm,
  },
  ladderRowFuture: {
    opacity: 0.55,
  },
  markerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  markerDotCurrent: {
    transform: [{ scale: 1.1 }],
  },
  ladderText: {
    flex: 1,
    minWidth: 0,
  },
  ladderName: {
    color: dsColors.textPrimary,
    fontSize: dsFont.size.bodyLg,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  ladderNameFuture: {
    color: dsColors.textSecondary,
  },
  ladderStatus: {
    marginTop: 2,
    color: dsColors.textSecondary,
    fontSize: dsFont.size.label,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  ladderThreshold: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.label,
    fontWeight: dsFont.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  ladderThresholdFuture: {
    color: dsColors.textTertiary,
  },
});
