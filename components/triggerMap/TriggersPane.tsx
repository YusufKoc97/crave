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
import { openPaywall } from '@/lib/paywall';
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
import { TriggersAccentProvider } from './triggersAccent';
// TEMP-TRIGGER-MOCK-DATA — remove import + fallback below before ship.
import { mockTriggerMapFor } from './__mockData';

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
 * Accent (2026-07-26): the module follows `addiction.color`, the same
 * way the sibling Comparison tab does. The 2026-07-21 redesign had
 * pinned it to a fixed violet, which meant Smoking's gold detail
 * screen flipped to violet on this one sub-tab — the addiction's
 * identity dropped out exactly where the user was looking at their
 * own data. Sub-components read the accent from
 * `TriggersAccentProvider` rather than props, because the tree is
 * deep and most accent values used to live in static style blocks.
 *
 * Category colours (stress coral, boredom green, social cyan) stay
 * fixed — the same feeling has to read the same across addictions.
 *
 * Motion: every card fades + rises in on a stagger and every headline
 * number counts up from zero (see `triggersMotion.tsx`), matching
 * Comparison. `index` is passed explicitly so the stagger order
 * follows the visual stack, not mount order.
 *
 * A subtle `TriggersAurora` layer sits behind everything so the
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
  // Mount-on-demand — @gorhom/bottom-sheet has a bug on RN Web where
  // it renders in the "open" position on initial mount even when
  // `index={-1}`, occupying the bottom half of the screen. Gating
  // the mount behind a "has ever been asked to open" flag sidesteps
  // it entirely: no cell tap → no sheet → no phantom overlay.
  const [sheetMounted, setSheetMounted] = useState(false);

  // TEMP-TRIGGER-MOCK-DATA — fall back to mock when the real query
  // has no data yet (design polish preview). Real users get real
  // data as soon as the Edge Function returns. Mock rotates per
  // period so the 7d / 30d / all pills feel like real filters.
  const usingMock = !query.data || query.data.cravings_count === 0;
  const data =
    query.data && query.data.cravings_count > 0
      ? query.data
      : mockTriggerMapFor(period);
  const cravingsCount = data.cravings_count;
  const isZero = false; // forced non-empty while mock is active
  const isSparse =
    !isZero &&
    cravingsCount >= CRAVING_THRESHOLD_SPARSE &&
    cravingsCount < CRAVING_THRESHOLD_FULL;
  const isFull = !isZero && cravingsCount >= CRAVING_THRESHOLD_FULL;

  // Loading state — the first fetch on this tab. Query keeps the
  // previous cache warm across period changes so this only fires
  // on the initial mount for a given (addiction, period) pair.
  // Skip spinner when the mock is doing the work.
  const showSpinner = query.isLoading && !query.data && !usingMock;

  const insights = data.insights;
  const accent = addiction.color;

  const content = (
    <View>
      {/* Section kicker — matches Journey's "THE PATH" and Toolkit's
          "TRY DURING A CRAVING" so all three sub-tabs read as one
          visual family with only the copy shifting per module. */}
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>{t('trigger_map.section_kicker')}</Text>
        <View style={styles.hairline} />
      </View>

      {!showSpinner && !(query.isError && !usingMock) && (
        <InsightSection
          insights={insights}
          addictionId={addiction.id}
          onAction={(actionKey) => {
            if (actionKey === 'open_toolkit') {
              onNavigateSubTab?.('toolkit');
            }
          }}
        />
      )}

      <PeriodFilter value={period} onChange={setPeriod} accentColor={accent} />

      {showSpinner && (
        <View style={styles.spinnerWrap}>
          <ActivityIndicator color={accent} />
        </View>
      )}

      {query.isError && !usingMock && !query.data && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {t('trigger_map.error.load_failed')}
          </Text>
        </View>
      )}

      {!showSpinner && !(query.isError && !usingMock) && isZero && (
        <EmptyState variant="zero" accentColor={accent} />
      )}

      {!showSpinner && (isSparse || isFull) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('trigger_map.heatmap.title')}
          </Text>
          <HeatmapGrid
            heatmap={data.heatmap}
            intensityMap={data.intensity_map}
            index={0}
            onCellPress={(day, hour) => {
              const count = data.heatmap[day]?.[hour] ?? 0;
              const avgIntensity = data.intensity_map[day]?.[hour] ?? null;
              const detail = { day, hour, count, avgIntensity };
              // Mount the sheet on first press, then open on the
              // next frame so the ref is wired before we ask it
              // to snap open.
              if (!sheetMounted) {
                setSheetMounted(true);
                requestAnimationFrame(() => {
                  cellSheetRef.current?.open(detail);
                });
              } else {
                cellSheetRef.current?.open(detail);
              }
            }}
          />
        </View>
      )}

      {!showSpinner && isSparse && (
        <EmptyState variant="sparse" accentColor={accent} />
      )}

      {!showSpinner && isFull && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('trigger_map.peak_hours.title')}
            </Text>
            <PeakHoursList
              peaks={data.peak_hours}
              heatmap={data.heatmap}
              triggers={data.triggers}
              addictionId={addiction.id}
              index={1}
            />
          </View>
          {/* Premium gate: the trigger DISTRIBUTION (the "why") is the
              paid interpretation layer. Free users keep the heatmap +
              peak hours (the "when") clear above, and see this one
              blurred with an unlock CTA. Insight cards stay free in v1
              — gating them too would need reordering the pane (they
              intentionally mount at the top) and would put a paywall
              card first, a poor first impression. */}
          {isPremium ? (
            <View style={styles.section}>
              <TriggerDistribution
                triggers={data.triggers}
                addictionId={addiction.id}
                periodLabel={t(`trigger_map.period.${period}`)}
                index={2}
              />
            </View>
          ) : (
            <FreeTierGate onUpgrade={() => openPaywall('triggers')}>
              <View style={styles.section}>
                <TriggerDistribution
                  triggers={data.triggers}
                  addictionId={addiction.id}
                  periodLabel={t(`trigger_map.period.${period}`)}
                  index={2}
                />
              </View>
            </FreeTierGate>
          )}
        </>
      )}
    </View>
  );

  // Premium gate is LIVE (2026-08-14): the trigger DISTRIBUTION section
  // above is gated on `useIsPremium()` via <FreeTierGate>. Everyone is
  // free today (useIsPremium() hardcoded false), so pre-launch this
  // simply means the distribution renders blurred with an unlock CTA
  // that is a no-op until the paywall milestone injects onUpgrade.
  return (
    <TriggersAccentProvider accent={accent}>
      <View style={styles.root}>
        {/* Ambient neutral layer — a whisper of colour behind the
            content so the pane matches Journey/Toolkit atmosphere.
            Sits BELOW all content by render order. */}
        <TriggersAurora />

        <View style={styles.wrap}>{content}</View>

        {/* Bottom sheet lives outside the gate so it can render
            full-screen without the blur veil above sitting on top
            of it. Mount-gated to work around a @gorhom/bottom-sheet
            bug on RN Web that renders in the open position on
            initial mount even with `index={-1}`. */}
        {sheetMounted ? (
          <CellDetailSheet ref={cellSheetRef} accentColor={accent} />
        ) : null}
      </View>
    </TriggersAccentProvider>
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
