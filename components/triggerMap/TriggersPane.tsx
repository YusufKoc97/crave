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
import { dsSectionHeaderStyle, dsSpacing } from '@/constants/designSystem';
import { PeriodFilter } from './PeriodFilter';
import { FreeTierGate } from './FreeTierGate';
import { EmptyState } from './EmptyStates';
import { HeatmapGrid } from './HeatmapGrid';
import { PeakHoursList } from './PeakHoursList';
import { TriggerDistribution } from './TriggerDistribution';
import { CellDetailSheet, type CellDetailSheetHandle } from './CellDetailSheet';
import { InsightSection } from './InsightSection';
import { TriggersAurora } from './TriggersAurora';
import { triggersAccent } from './triggersTheme';

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
 *
 * Triggers-redesign (2026-07-21): the module now owns a dedicated
 * violet accent (`triggersAccent`). Sub-components no longer receive
 * `addiction.color` — the addiction identity is expressed by the
 * detail-screen header + AmbientGlow above; this pane paints its
 * own charts in violet regardless of which addiction is open. A
 * subtle `TriggersAurora` layer sits behind everything so the
 * chart cards read as glass instead of floating on cold navy.
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
      {/* Section kicker — matches Journey's "THE PATH" and Toolkit's
          "TRY DURING A CRAVING" so all three sub-tabs read as one
          visual family with only the copy shifting per module. */}
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>{t('trigger_map.section_kicker')}</Text>
        <View style={styles.hairline} />
      </View>

      {!showSpinner && !query.isError && (
        <InsightSection
          insights={insights}
          addictionId={addiction.id}
          accentColor={triggersAccent}
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
        accentColor={triggersAccent}
      />

      {showSpinner && (
        <View style={styles.spinnerWrap}>
          <ActivityIndicator color={triggersAccent} />
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
        <EmptyState variant="zero" accentColor={triggersAccent} />
      )}

      {!showSpinner && (isSparse || isFull) && query.data && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('trigger_map.heatmap.title')}
          </Text>
          <HeatmapGrid
            heatmap={query.data.heatmap}
            intensityMap={query.data.intensity_map}
            accentColor={triggersAccent}
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
        <EmptyState variant="sparse" accentColor={triggersAccent} />
      )}

      {!showSpinner && isFull && query.data && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('trigger_map.peak_hours.title')}
            </Text>
            <PeakHoursList
              peaks={query.data.peak_hours}
              accentColor={triggersAccent}
            />
          </View>
          <View style={styles.section}>
            <TriggerDistribution
              triggers={query.data.triggers}
              accentColor={triggersAccent}
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
    <View style={styles.root}>
      {/* Ambient violet layer — a whisper of colour behind the
          content so the pane matches Journey/Toolkit atmosphere.
          Sits BELOW all content by render order. */}
      <TriggersAurora />

      <View style={styles.wrap}>{content}</View>

      {/* Bottom sheet lives outside the gate so it can render
          full-screen without the blur veil above sitting on top
          of it. */}
      <CellDetailSheet ref={cellSheetRef} accentColor={triggersAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 0,
    marginBottom: dsSpacing.md,
  },
  kicker: {
    ...dsSectionHeaderStyle,
    marginTop: 0,
    marginBottom: 0,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
