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
import { InsightSection } from './InsightSection';

/**
 * Faz 8a — Modül 3 root panel. Renders the trigger-map response
 * from the Edge Function inside the Info → Triggers sub-tab.
 *
 * Progressive disclosure gates:
 *   count == 0   → EmptyState zero (all sections hidden below insights)
 *   count 1–5   → Heatmap (sparse), peak + distribution hidden,
 *                  small "keep tracking" nudge underneath
 *   count 6+     → All three sections visible
 *
 * Insights (Faz 8b) mount at the top independent of the gates —
 * a silence-check rule can fire on 5+ historic cravings even when
 * the current-period slice reads sparse.
 *
 * Free-tier layer: when the user isn't premium, the whole content
 * region is wrapped in `<FreeTierGate>` — content still renders
 * underneath but is blurred + veiled, with an Upgrade CTA.
 */

type Props = {
  addiction: Addiction;
  /** Faz 8b — invoked by the InsightCard "open_toolkit" action. */
  onNavigateSubTab?: (tab: 'toolkit') => void;
};

export function TriggersPane({ addiction, onNavigateSubTab }: Props) {
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

  const insights = query.data?.insights ?? [];

  const content = (
    <View>
      {!showSpinner && !query.isError && (
        <InsightSection
          insights={insights}
          addictionId={addiction.id}
          accentColor={addiction.color}
          onAction={(actionKey) => {
            if (actionKey === 'open_toolkit') {
              onNavigateSubTab?.('toolkit');
            }
          }}
        />
      )}

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

  // TEMP-PREMIUM-GATE-DISABLED — 2026-07-18
  // Trigger-map paywall is intentionally lifted for design & code
  // iteration on this tab. Real gate MUST be restored before ship;
  // restore by wrapping `content` in <FreeTierGate> and gating on
  // `useIsPremium()` the same way every other paywalled surface
  // will. Grep for TEMP-PREMIUM-GATE-DISABLED to find every knob
  // that needs flipping back. Do not delete the FreeTierGate import
  // or `isPremium` binding — leaving them in place keeps the diff
  // to a one-line JSX swap when we come back.
  void isPremium;
  void FreeTierGate;

  return (
    <View style={styles.wrap}>
      {content}
      {/* Bottom sheet lives outside the gate so it can render
          full-screen without the blur veil above sitting on top
          of it. */}
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
