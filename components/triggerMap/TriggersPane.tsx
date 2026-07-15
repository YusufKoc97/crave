import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  CRAVING_THRESHOLD_FULL,
  CRAVING_THRESHOLD_SPARSE,
  DEFAULT_PERIOD,
  type PeriodKey,
} from '@/constants/heatmap';
import type { Addiction } from '@/constants/addictions';
import { useTriggerMap } from '@/lib/triggerMap';
import { useIsPremium } from '@/lib/premium';
import { t } from '@/lib/i18n';
import { PeriodFilter } from './PeriodFilter';
import { FreeTierGate } from './FreeTierGate';
import { EmptyState } from './EmptyStates';
import { HeatmapGrid } from './HeatmapGrid';
import { PeakHoursList } from './PeakHoursList';
import { TriggerDistribution } from './TriggerDistribution';
import { CellDetailSheet, type CellDetailSheetHandle } from './CellDetailSheet';

/**
 * Faz 8a — Modül 3 root panel. Renders the trigger-map response
 * from the Edge Function inside the Info → Triggers sub-tab.
 *
 * Progressive disclosure gates (Faz 8a scope — no insights):
 *   count == 0   → EmptyState zero (heatmap + peak + distribution hidden)
 *   count 1–5   → Heatmap (sparse), peak + distribution hidden,
 *                  small "keep tracking" nudge underneath
 *   count 6+     → All three sections visible
 *
 * Free-tier layer: when the user isn't premium, the whole content
 * region is wrapped in `<FreeTierGate>` — content still renders
 * underneath but is blurred + veiled, with an Upgrade CTA.
 *
 * Sections 2 (Heatmap), 3 (Peak Hours), 4 (Distribution) mount
 * as placeholders here; each is filled in by M5–M6.
 */

type Props = {
  addiction: Addiction;
};

export function TriggersPane({ addiction }: Props) {
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const isPremium = useIsPremium();
  const query = useTriggerMap(addiction.id, period);
  const cellSheetRef = useRef<CellDetailSheetHandle>(null);

  const cravingsCount = query.data?.cravings_count ?? 0;
  const isZero = !query.data || cravingsCount === 0;
  const isSparse =
    !isZero &&
    cravingsCount >= CRAVING_THRESHOLD_SPARSE &&
    cravingsCount < CRAVING_THRESHOLD_FULL;
  const isFull = !isZero && cravingsCount >= CRAVING_THRESHOLD_FULL;

  // Loading state — the first fetch on this tab. Query keeps the
  // previous cache warm across period changes so this only fires
  // on the initial mount for a given (addiction, period) pair.
  const showSpinner = query.isLoading && !query.data;

  const content = (
    <View>
      <PeriodFilter
        value={period}
        onChange={setPeriod}
        accentColor={addiction.color}
      />

      {showSpinner && (
        <View style={styles.spinnerWrap}>
          <ActivityIndicator color={addiction.color} />
        </View>
      )}

      {query.isError && !query.data && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {t('trigger_map.error.load_failed')}
          </Text>
        </View>
      )}

      {!showSpinner && !query.isError && isZero && (
        <EmptyState variant="zero" accentColor={addiction.color} />
      )}

      {!showSpinner && (isSparse || isFull) && query.data && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('trigger_map.heatmap.title')}
          </Text>
          <HeatmapGrid
            heatmap={query.data.heatmap}
            intensityMap={query.data.intensity_map}
            accentColor={addiction.color}
            onCellPress={(day, hour) => {
              const count = query.data?.heatmap[day]?.[hour] ?? 0;
              const avgIntensity =
                query.data?.intensity_map[day]?.[hour] ?? null;
              cellSheetRef.current?.open({
                day,
                hour,
                count,
                avgIntensity,
              });
            }}
          />
        </View>
      )}

      {!showSpinner && isSparse && (
        <EmptyState variant="sparse" accentColor={addiction.color} />
      )}

      {!showSpinner && isFull && query.data && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('trigger_map.peak_hours.title')}
            </Text>
            <PeakHoursList
              peaks={query.data.peak_hours}
              accentColor={addiction.color}
            />
          </View>
          <View style={styles.section}>
            <TriggerDistribution
              triggers={query.data.triggers}
              accentColor={addiction.color}
              addictionId={addiction.id}
              periodLabel={t(`trigger_map.period.${period}`)}
            />
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {isPremium ? content : <FreeTierGate>{content}</FreeTierGate>}
      {/* Bottom sheet lives outside the gate so it can render
          full-screen without the blur veil above sitting on top
          of it. Only Premium users can meaningfully tap cells
          (free-tier ones are behind the veil), but hoisting the
          sheet keeps the layer order correct if that assumption
          ever loosens. */}
      <CellDetailSheet ref={cellSheetRef} accentColor={addiction.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  spinnerWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
});
