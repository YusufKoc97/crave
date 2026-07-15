import { StyleSheet, Text, View } from 'react-native';
import { RANK_LADDER } from '@/constants/rankLadder';
import type { JourneyView } from '@/context/AddictionScoresContext';
import { t } from '@/lib/i18n';
import { Card } from '@/components/Card';
import { colors } from '@/constants/theme';

/**
 * Journey view for Module 1 — horizontal compact summary at the top,
 * vertical ladder underneath. Both driven off the same `JourneyView`
 * object so the two halves can never disagree about what the current
 * rank is.
 *
 * "Current rank" = highest unlocked (never demoted on failure).
 * Progress bar shows the fraction from current rank threshold to the
 * next one on the ladder; ceiling users see a saturated bar.
 */

type Props = {
  view: JourneyView;
  /** Color-locked accent (from the addiction catalog) — every rank
   *  marker + progress fill picks this up so each addiction's
   *  journey feels distinct without needing a per-addiction palette. */
  accentColor: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Locale-agnostic short form so it renders sensibly across regions.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function JourneyBar({ view, accentColor }: Props) {
  const { score, currentRank, nextRank, progress, unlockedIds, unlockedAt } =
    view;

  const remaining = nextRank ? Math.max(0, nextRank.thresholdScore - score) : 0;

  return (
    <View style={styles.root}>
      {/* ── Horizontal compact summary card ─────────────────────── */}
      <Card
        variant="elevated"
        style={styles.summary}
        borderRadius={16}
        showHighlight
      >
        <View style={styles.summaryHeader}>
          <View style={styles.summaryHeaderLeft}>
            <Text style={styles.kicker}>{t('journey.your_rank')}</Text>
            <Text style={[styles.rankName, { color: accentColor }]}>
              {currentRank.name}
            </Text>
            <Text style={styles.rankDescription}>
              {currentRank.description}
            </Text>
          </View>
          <View style={styles.summaryHeaderRight}>
            <Text style={styles.scoreKicker}>{t('journey.score_label')}</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
        </View>

        {/* Horizontal 9-dot progress across all ranks + fill bar
            underneath. Compact, scannable at a glance. */}
        <View style={styles.dotRow} pointerEvents="none">
          {RANK_LADDER.map((rank) => {
            const isCurrent = rank.id === currentRank.id;
            const isUnlocked = unlockedIds.has(rank.id);
            return (
              <View
                key={rank.id}
                style={[
                  styles.dot,
                  {
                    borderColor: isUnlocked ? accentColor : '#1E2D4D',
                    backgroundColor: isCurrent
                      ? accentColor
                      : isUnlocked
                        ? hexAlpha(accentColor, 0.35)
                        : '#0A1628',
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.trackFill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: accentColor,
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
      </Card>

      {/* ── Vertical detailed ladder ────────────────────────────── */}
      <Text style={styles.laddderKicker}>{t('journey.ladder_title')}</Text>
      <View style={styles.ladderList}>
        {RANK_LADDER.map((rank) => {
          const isCurrent = rank.id === currentRank.id;
          const isUnlocked = unlockedIds.has(rank.id);
          const isFuture = !isUnlocked && !isCurrent;
          // Marker glyph — Latin, no emoji, keeps consistent line
          // height. ✓ (unlocked past), ● (current), ○ (locked).
          const marker = isCurrent ? '●' : isUnlocked ? '✓' : '○';
          const markerColor = isCurrent
            ? accentColor
            : isUnlocked
              ? accentColor
              : '#3D5470';
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
                  backgroundColor: hexAlpha(accentColor, 0.06),
                },
                isFuture && styles.ladderRowFuture,
              ]}
            >
              <Text style={[styles.marker, { color: markerColor }]}>
                {marker}
              </Text>
              <View style={styles.ladderText}>
                <Text
                  style={[
                    styles.ladderName,
                    isFuture && styles.ladderNameFuture,
                  ]}
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

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  summary: {
    padding: 18,
    backgroundColor: '#0A1628',
    borderColor: '#1A2840',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  summaryHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  summaryHeaderRight: {
    alignItems: 'flex-end',
  },
  kicker: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  rankName: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  rankDescription: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  scoreKicker: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  scoreValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '600',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0D1E35',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
  },
  nextHint: {
    marginTop: 10,
    color: '#7BA8C8',
    fontSize: 11.5,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  laddderKicker: {
    marginTop: 24,
    marginBottom: 10,
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
    paddingHorizontal: 2,
  },
  ladderList: {
    // Rows are self-styled — no extra wrapping here.
  },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#13213A',
    marginBottom: 6,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
  },
  ladderRowFuture: {
    opacity: 0.5,
  },
  marker: {
    fontSize: 18,
    lineHeight: 20,
    minWidth: 20,
    textAlign: 'center',
  },
  ladderText: {
    flex: 1,
    minWidth: 0,
  },
  ladderName: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  ladderNameFuture: {
    color: '#6B8BA4',
  },
  ladderStatus: {
    marginTop: 2,
    color: '#6B8BA4',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  ladderThreshold: {
    color: '#7BA8C8',
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  ladderThresholdFuture: {
    color: '#3D5470',
  },
});
