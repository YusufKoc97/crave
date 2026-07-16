import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ADDICTION_CATALOG,
  toAddiction,
  type Addiction,
} from '@/constants/addictions';
import { useAddictions } from '@/context/AddictionsContext';
import { useAddictionScores } from '@/context/AddictionScoresContext';
import {
  dsCardStyles,
  dsColors,
  dsFont,
  dsRadius,
  dsSectionHeaderStyle,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import { t } from '@/lib/i18n';

/**
 * Info tab main screen — a directory of the 10 catalog addictions,
 * split into "TRACKING" (currently active) and "ALL ADDICTIONS"
 * (everything else). Tapping any row navigates to
 * `/info/[addictionId]` where the 4-module landing page lives.
 *
 * Design-polish M1: cards restyled per the design system spec.
 * TRACKING rows are 88pt "Send Money"-style — big surface, name +
 * rank inline, addiction-color chip. ALL ADDICTIONS rows are 56pt
 * "Habit Tracker"-style — smaller surface, "Not tracked" trailing
 * label. Both surfaces use the shared dsCardStyles primitives.
 */
export default function InfoScreen() {
  const { activeIds } = useAddictions();
  const { viewFor } = useAddictionScores();

  const { tracked, other } = useMemo(() => {
    const trackedRows: Addiction[] = [];
    const otherRows: Addiction[] = [];
    for (const entry of ADDICTION_CATALOG) {
      const addiction = toAddiction(entry);
      if (activeIds.has(entry.id)) trackedRows.push(addiction);
      else otherRows.push(addiction);
    }
    return { tracked: trackedRows, other: otherRows };
  }, [activeIds]);

  const goToLanding = (addictionId: string) => {
    // Cast: expo-router's typed routes cache (`.expo/types/router.d.ts`)
    // is generated at dev-server startup and doesn't know about the new
    // /info/[addictionId] route until Metro has run once. The URL is
    // correct — this is a build-time typegen lag, not a runtime bug.
    router.push(
      `/info/${addictionId}` as unknown as Parameters<typeof router.push>[0]
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t('info.screen_title')}</Text>

      {/* ── Tracking section — big 88pt "Send Money" cards ───────── */}
      <Text style={styles.sectionLabel}>{t('info.section_tracking')}</Text>
      {tracked.length === 0 ? (
        <Text style={styles.emptyLine}>{t('info.empty_tracking')}</Text>
      ) : (
        tracked.map((a) => {
          const view = viewFor(a.id);
          return (
            <Pressable
              key={a.id}
              onPress={() => goToLanding(a.id)}
              style={({ pressed }) => [
                styles.trackingRow,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${a.name} details`}
            >
              <View
                style={[
                  styles.trackingEmojiChip,
                  {
                    backgroundColor: hexAlpha(a.color, 0.15),
                    borderColor: hexAlpha(a.color, 0.35),
                  },
                ]}
              >
                <Text style={styles.trackingEmoji}>{a.emoji}</Text>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.trackingName}>{a.name}</Text>
                <Text style={styles.rankLine}>
                  <Text style={[styles.rankName, { color: a.color }]}>
                    {view.currentRank.name}
                  </Text>
                  <Text style={styles.dotSep}> · </Text>
                  <Text style={styles.scoreInline}>{view.score} pts</Text>
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={dsColors.textTertiary}
              />
            </Pressable>
          );
        })
      )}

      {/* ── All addictions — compact 56pt cards ──────────────────── */}
      <Text style={[styles.sectionLabel, styles.sectionLabelAll]}>
        {t('info.section_all')}
      </Text>
      {other.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => goToLanding(a.id)}
          style={({ pressed }) => [
            styles.untrackedRow,
            pressed && styles.rowPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${a.name} details`}
        >
          <View
            style={[
              styles.untrackedEmojiChip,
              {
                backgroundColor: hexAlpha(a.color, 0.12),
                borderColor: hexAlpha(a.color, 0.28),
              },
            ]}
          >
            <Text style={styles.untrackedEmoji}>{a.emoji}</Text>
          </View>
          <Text style={styles.untrackedName} numberOfLines={1}>
            {a.name}
          </Text>
          <Text style={styles.notTracked}>{t('info.not_tracked')}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dsColors.bgBase,
  },
  content: {
    paddingTop: 64,
    paddingHorizontal: dsSpacing.xl,
    paddingBottom: 110,
  },
  title: {
    color: dsColors.textPrimary,
    fontSize: dsFont.size.displayXl,
    fontWeight: dsFont.weight.bold,
    marginTop: dsSpacing.xl,
    marginBottom: dsSpacing.md,
  },
  sectionLabel: {
    ...dsSectionHeaderStyle,
    paddingHorizontal: 2,
  },
  sectionLabelAll: {
    // Section header default marginTop is x3l (32) — keep parity.
  },
  emptyLine: {
    color: dsColors.textTertiary,
    fontSize: 12.5,
    fontStyle: 'italic',
    paddingVertical: dsSpacing.md,
    lineHeight: 18,
  },

  // ── Tracking card (88pt) ──
  trackingRow: {
    ...dsCardStyles.tracking,
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.lg,
    marginBottom: dsSpacing.md,
  },
  trackingEmojiChip: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  trackingEmoji: {
    fontSize: 28,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  trackingName: {
    color: dsColors.textPrimary,
    fontSize: dsFont.size.heading,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  rankLine: {
    marginTop: dsSpacing.xs,
    fontSize: 14,
  },
  rankName: {
    fontWeight: dsFont.weight.semibold,
  },
  dotSep: {
    color: dsColors.textTertiary,
  },
  scoreInline: {
    color: dsColors.textSecondary,
  },

  // ── Untracked card (56pt) ──
  untrackedRow: {
    ...dsCardStyles.untracked,
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.md,
    marginBottom: dsSpacing.sm,
  },
  untrackedEmojiChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  untrackedEmoji: {
    fontSize: 18,
  },
  untrackedName: {
    flex: 1,
    color: dsColors.textPrimary,
    fontSize: dsFont.size.body,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  notTracked: {
    color: dsColors.textTertiary,
    fontSize: 12,
    letterSpacing: dsFont.letterSpacing.tight,
  },

  rowPressed: {
    opacity: 0.7,
    backgroundColor: dsColors.cardSurfaceElevated,
    borderRadius: dsRadius.card,
  },
});
