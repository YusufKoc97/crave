import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { RANK_LADDER } from '@/constants/rankLadder';
import type { JourneyView } from '@/context/AddictionScoresContext';
import { t } from '@/lib/i18n';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  dsColors,
  dsFont,
  dsRadius,
  dsSectionHeaderStyle,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';

/**
 * Journey view for Module 1 — hero rank card at top, vertical ladder
 * underneath. Both driven off the same `JourneyView` object so the
 * two halves can never disagree about what the current rank is.
 *
 * "Current rank" = highest unlocked (never demoted on failure).
 * Progress bar animates from 0 to `progress` on mount (Reanimated
 * width interpolation) — subtle 800ms ease-out per the polish brief.
 *
 * Design-polish M3: cards + ladder rows repainted with the new
 * design system palette; addiction color remains the sole accent
 * (progress fill, current-rank marker, current-row border tint).
 */

type Props = {
  view: JourneyView;
  /** Color-locked accent (from the addiction catalog). */
  accentColor: string;
};

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

  // Animate progress bar on mount — 0 → target width, ease-out.
  // Runs once per (progress, accent) tuple; not driven on every
  // re-render (score updates fire this too, which is the intent).
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = 0;
    anim.value = withTiming(progress, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [anim, progress]);
  const trackFillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(anim.value * 100)}%`,
  }));

  return (
    <View style={styles.root}>
      {/* ── Hero rank card ─────────────────────────────────────── */}
      <SurfaceCard
        variant="elevated"
        radius={dsRadius.card}
        style={styles.heroCard}
      >
        <View style={styles.heroHeader}>
          <View style={styles.heroHeaderLeft}>
            <Text style={styles.kicker}>{t('journey.your_rank')}</Text>
            <Text style={[styles.rankName, { color: accentColor }]}>
              {currentRank.name}
            </Text>
            <Text style={styles.rankDescription}>
              {currentRank.description}
            </Text>
          </View>
          <View style={styles.heroHeaderRight}>
            <Text style={styles.scoreKicker}>{t('journey.score_label')}</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
        </View>

        <View style={styles.track}>
          <Animated.View
            style={[
              styles.trackFill,
              trackFillStyle,
              {
                backgroundColor: accentColor,
                shadowColor: accentColor,
              },
            ]}
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
      </SurfaceCard>

      {/* ── Vertical detailed ladder ────────────────────────────── */}
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

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: dsSpacing.xl,
    paddingBottom: dsSpacing.x4l,
  },
  heroCard: {
    padding: dsSpacing.xxl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: dsSpacing.xl,
  },
  heroHeaderLeft: {
    flex: 1,
    paddingRight: dsSpacing.md,
  },
  heroHeaderRight: {
    alignItems: 'flex-end',
  },
  kicker: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.tiny,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.caps,
    textTransform: 'uppercase',
    marginBottom: dsSpacing.sm,
  },
  rankName: {
    fontSize: dsFont.size.displayMd,
    fontWeight: dsFont.weight.bold,
    letterSpacing: dsFont.letterSpacing.normal,
    marginBottom: dsSpacing.xs,
  },
  rankDescription: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.label,
    lineHeight: 18,
  },
  scoreKicker: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.tiny,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.caps,
    textTransform: 'uppercase',
    marginBottom: dsSpacing.xs,
  },
  scoreValue: {
    color: dsColors.textPrimary,
    fontSize: dsFont.size.displayXxl,
    fontWeight: dsFont.weight.bold,
    fontVariant: ['tabular-nums'],
    lineHeight: dsFont.size.displayXxl,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: dsColors.borderSubtle,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  nextHint: {
    marginTop: dsSpacing.md,
    color: dsColors.textSecondary,
    fontSize: dsFont.size.label,
    letterSpacing: dsFont.letterSpacing.tight,
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
    // Slightly larger visual weight for the "you are here" indicator.
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
