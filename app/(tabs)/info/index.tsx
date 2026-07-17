import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ADDICTION_CATALOG,
  toAddiction,
  type Addiction,
} from '@/constants/addictions';
import { useAddictions } from '@/context/AddictionsContext';
import { useAddictionScores } from '@/context/AddictionScoresContext';
import { AddictionCard } from '@/components/info/AddictionCard';
import {
  CARD_GAP,
  CHIP_BG,
  CHIP_BORDER,
  FONT_STACK,
  HAIRLINE_START,
  PAGE_BG_MID,
  TEXT_CHIP,
  TEXT_SECTION_LABEL,
  TEXT_SUBTITLE,
  TEXT_TITLE,
} from '@/components/info/cardStyle';
import { t } from '@/lib/i18n';

/**
 * Info tab home — "Addictions" grid.
 *
 * Two 2-column grids: TRACKING (currently active) on top, ALL
 * ADDICTIONS below. Section headers show a count chip and a
 * hairline separator. Empty TRACKING renders a dashed placeholder
 * card that hints "pick one below" (karar #8).
 *
 * Tap card body → detail (unchanged navigation).
 * Tap "+ Track" pill on untracked → addAddiction + refresh scores.
 * Long-press / remove tracking still lives in the detail screen,
 * NOT here (karar #1 — one card, one purpose on this list).
 */
export default function InfoScreen() {
  const { activeIds, atLimit, addAddiction } = useAddictions();
  const { viewFor, refresh } = useAddictionScores();

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
    // Cast: expo-router's typed routes cache doesn't know about the
    // nested /info/[addictionId] route until Metro runs. Runtime OK.
    router.push(
      `/info/${addictionId}` as unknown as Parameters<typeof router.push>[0]
    );
  };

  const onStartTracking = async (addictionId: string, name: string) => {
    if (atLimit) {
      Alert.alert(t('errors.addiction_limit_reached'));
      return;
    }
    try {
      await addAddiction(addictionId);
      await refresh();
    } catch (e) {
      Alert.alert('Could not start tracking', (e as Error).message);
    }
    // No navigation on success — the card just animates into the
    // TRACKING section on the next render. If we ever want to whisk
    // the user into the newly-tracked detail, hook here.
    void name;
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t('info.screen_title')}</Text>
      <Text style={styles.subtitle}>{t('info.screen_subtitle')}</Text>

      {/* ── Tracking section ─────────────────────────────────────── */}
      <SectionHeader
        label={t('info.section_tracking')}
        count={tracked.length}
      />
      {tracked.length === 0 ? (
        <EmptyTrackedCard />
      ) : (
        <View style={styles.grid}>
          {tracked.map((a) => {
            const view = viewFor(a.id);
            return (
              <View key={a.id} style={styles.gridItem}>
                <AddictionCard
                  addiction={a}
                  tracked
                  progress={view.progress}
                  level={view.currentRank.order}
                  nextLabel={view.nextRank?.name ?? t('info.rank_maxed')}
                  statusMain={view.currentRank.name}
                  onPress={() => goToLanding(a.id)}
                />
              </View>
            );
          })}
        </View>
      )}

      {/* ── All addictions ───────────────────────────────────────── */}
      <SectionHeader label={t('info.section_all')} count={other.length} />
      <View style={styles.grid}>
        {other.map((a) => (
          <View key={a.id} style={styles.gridItem}>
            <AddictionCard
              addiction={a}
              tracked={false}
              progress={0}
              level={1}
              nextLabel=""
              statusMain={t('info.not_tracked')}
              onPress={() => goToLanding(a.id)}
              onStartTracking={() => onStartTracking(a.id, a.name)}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chip}>
        <Text style={styles.chipText}>{count}</Text>
      </View>
      <View style={styles.hairline} />
    </View>
  );
}

function EmptyTrackedCard() {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{t('info.empty_tracking')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAGE_BG_MID,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 130,
  },
  title: {
    color: TEXT_TITLE,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
    fontFamily: FONT_STACK,
  },
  subtitle: {
    color: TEXT_SUBTITLE,
    fontSize: 13.5,
    marginBottom: 26,
    fontFamily: FONT_STACK,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: TEXT_SECTION_LABEL,
    fontFamily: FONT_STACK,
    textTransform: 'uppercase',
  },
  chip: {
    backgroundColor: CHIP_BG,
    borderColor: CHIP_BORDER,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: TEXT_CHIP,
    fontFamily: FONT_STACK,
    letterSpacing: 0.3,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_START,
    opacity: 0.6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    marginBottom: 34,
  },
  gridItem: {
    // Fills exactly half the container (minus half the gap).
    width: `${(100 - 0) / 2}%`,
    // Instead of hand-computing, let flex do it: basis 48% + gap 13 = 100%.
    // Using flexBasis so gap works cleanly on both Web and native.
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: `48%`,
  },
  emptyCard: {
    marginBottom: 34,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: TEXT_SUBTITLE,
    fontSize: 13,
    fontFamily: FONT_STACK,
    textAlign: 'center',
  },
});
