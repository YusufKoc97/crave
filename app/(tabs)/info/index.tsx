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
import { t } from '@/lib/i18n';

/**
 * Info tab main screen — a directory of the 10 catalog addictions,
 * split into "TRACKING" (currently active) and "ALL ADDICTIONS"
 * (everything else). Tapping any row navigates to
 * `/info/[addictionId]` where the 4-module landing page lives.
 *
 * The tracking section surfaces the current rank name inline so a
 * user can eyeball their progress across addictions without opening
 * each landing page. Non-tracked rows show the i18n description
 * instead — enough context to decide whether to start tracking.
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

      {/* ── Tracking section ─────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{t('info.section_tracking')}</Text>
      {tracked.length === 0 ? (
        <Text style={styles.emptyLine}>{t('info.empty_tracking')}</Text>
      ) : (
        tracked.map((a) => {
          const view = viewFor(a.id);
          return (
            <Pressable
              key={a.id}
              style={styles.row}
              onPress={() => goToLanding(a.id)}
              accessibilityRole="button"
              accessibilityLabel={`${a.name} details`}
            >
              <View style={[styles.emojiChip, { backgroundColor: a.bgGlow }]}>
                <Text style={styles.emoji}>{a.emoji}</Text>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.name}>{a.name}</Text>
                <Text style={styles.rankLine}>
                  <Text style={[styles.rankName, { color: a.color }]}>
                    {view.currentRank.name}
                  </Text>
                  <Text style={styles.dotSep}> · </Text>
                  <Text style={styles.scoreInline}>{view.score} pts</Text>
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#6B8BA4" />
            </Pressable>
          );
        })
      )}

      {/* ── All addictions ───────────────────────────────────────── */}
      <Text style={[styles.sectionLabel, styles.sectionLabelAll]}>
        {t('info.section_all')}
      </Text>
      {other.map((a) => (
        <Pressable
          key={a.id}
          style={styles.row}
          onPress={() => goToLanding(a.id)}
          accessibilityRole="button"
          accessibilityLabel={`${a.name} details`}
        >
          <View style={[styles.emojiChip, { backgroundColor: a.bgGlow }]}>
            <Text style={styles.emoji}>{a.emoji}</Text>
          </View>
          <View style={styles.textCol}>
            <Text style={styles.name}>{a.name}</Text>
            <Text style={styles.notTracked}>{t('info.not_tracked')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#6B8BA4" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
  },
  content: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionLabelAll: {
    marginTop: 32,
  },
  emptyLine: {
    color: '#6B8BA4',
    fontSize: 12.5,
    fontStyle: 'italic',
    paddingVertical: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    marginBottom: 8,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
  },
  emojiChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emoji: {
    fontSize: 20,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: '#F1F5F9',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  rankLine: {
    marginTop: 3,
    fontSize: 11.5,
  },
  rankName: {
    fontWeight: '600',
  },
  dotSep: {
    color: '#3D5470',
  },
  scoreInline: {
    color: '#94A3B8',
  },
  notTracked: {
    marginTop: 3,
    color: '#6B8BA4',
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
});
