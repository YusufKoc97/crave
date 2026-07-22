import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { dsSectionHeaderStyle, dsSpacing } from '@/constants/designSystem';
import { ComparisonAurora } from './ComparisonAurora';
import { PulseCard } from './PulseCard';
import { DistributionCard } from './DistributionCard';
import { StandingCard } from './StandingCard';
import { PatternCard } from './PatternCard';
import { LaunchState } from './LaunchState';
import { LowDataBanner } from './LowDataState';
import { FreeGate } from './FreeGate';
import { compColors, compHexAlpha } from './comparisonTheme';
// TEMP-COMPARISON-MOCK-DATA — remove import + call in ComparisonPane
// when the real `comparison-data` Edge Function lands.
import { mockComparisonFor, type ComparisonState } from './__mockData';

/**
 * Modül 4 root panel — the "gözlemevi" (observatory).
 *
 * Renders four vertical sections that compare the user's progress
 * with the anonymous aggregate of everyone resisting the same
 * addiction:
 *   1. Community Pulse (living stats strip)
 *   2. You vs. Community (3 bell-curve metric cards)
 *   3. Your Standing (percentile hero)
 *   4. Community Patterns (3 mini-viz aggregate cards)
 *
 * Four states cycle via a dev-only ◑ chip in the header — Full /
 * Launch / Low-data / Free. Production only ever shows the state
 * the backend signals; the chip is `__DEV__`-only.
 *
 * The addiction's accent color drives every accent surface in
 * this pane (unlike Triggers, which owns violet globally). The
 * pane sits on top of the parent detail screen's two AmbientGlow
 * layers, plus its own subtle ComparisonAurora grey-blue tint.
 *
 * Data flow (temp): `mockComparisonFor(state)` returns a canned
 * dataset for the selected chip state. When the Edge Function
 * lands, replace that single call with the query result.
 *
 * Free-tier gate is DEFINED (see `FreeGate.tsx`) but not mounted
 * because paywalling all downstream module surfaces is deferred
 * to a dedicated Premium milestone. TEMP-PREMIUM-GATE-DISABLED —
 * one-line JSX swap in `renderStateContent` will restore it.
 */

type Props = {
  addiction: Addiction;
};

export function ComparisonPane({ addiction }: Props) {
  const [state, setState] = useState<ComparisonState>('full');
  const data = mockComparisonFor(state);

  // Full / Free / LowData all render the Distribution grid;
  // Launch swaps the grid for the LaunchState marketing panel.
  // Free will one day wrap FULL content in `<FreeGate>` — see
  // TEMP-PREMIUM-GATE-DISABLED marker below.
  const isLowData = state === 'lowdata';
  const isLaunch = state === 'launch';

  // Standing hero renders only when we have both community
  // aggregates AND enough personal data — i.e. FULL / FREE only.
  const showStanding = state === 'full' || state === 'free';
  // Community Patterns render on FULL + FREE (LowData + Launch
  // hide them to keep the story consistent).
  const showPatterns = state === 'full' || state === 'free';

  // TEMP-PREMIUM-GATE-DISABLED — Comparison Free-tier gate is
  // intentionally NOT mounted yet. `FreeGate` is imported so
  // linting doesn't drop the reference and so the eventual swap
  // is one JSX line. When paywall lands, wrap the downstream
  // `content` in <FreeGate addiction={} onUpgrade={...}>.
  void FreeGate;

  return (
    <View style={styles.root}>
      <ComparisonAurora />

      <View style={styles.wrap}>
        {/* Module kicker — matches Journey's "THE PATH", Toolkit's
            "TRY DURING A CRAVING", Triggers' "WHAT LIGHTS THE
            FUSE". */}
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>{t('comparison.section_kicker')}</Text>
          <View style={styles.hairline} />
        </View>

        {/* Dev-only state cycler chip — never renders in prod. */}
        {__DEV__ ? (
          <DevStateChip
            state={state}
            onCycle={() => setState(cycleState(state))}
            accentColor={addiction.color}
          />
        ) : null}

        {/* 1. Community Pulse — always visible (Free too). */}
        <PulseCard addiction={addiction} data={data.pulse} />

        {isLaunch ? (
          <View style={{ marginTop: 22 }}>
            <LaunchState
              addiction={addiction}
              count={data.pulse.peopleThisWeek}
            />
          </View>
        ) : (
          <>
            {/* Section 2: You vs. Community */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionKicker}>
                {t('comparison.you_vs_community')}
              </Text>
              <View style={styles.sectionRule} />
            </View>

            {isLowData ? (
              <LowDataBanner addiction={addiction} done={4} total={6} />
            ) : null}

            <View style={styles.stack}>
              {data.distribution.map((metric, i) => (
                <DistributionCard
                  key={metric.key}
                  metric={metric}
                  addiction={addiction}
                  index={i}
                  ghost={isLowData}
                />
              ))}
            </View>

            {showStanding ? (
              <View style={{ marginTop: 20 }}>
                <StandingCard addiction={addiction} data={data.standing} />
              </View>
            ) : null}

            {showPatterns ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionKicker}>
                    {t('comparison.community_patterns')}
                  </Text>
                  <View style={styles.sectionRule} />
                </View>
                <View style={styles.stack}>
                  <PatternCard
                    kind="clock"
                    data={data.patterns}
                    addiction={addiction}
                    index={0}
                  />
                  <PatternCard
                    kind="wave"
                    data={data.patterns}
                    addiction={addiction}
                    index={1}
                  />
                  <PatternCard
                    kind="bar"
                    data={data.patterns}
                    addiction={addiction}
                    index={2}
                  />
                </View>
              </>
            ) : null}
          </>
        )}

        {/* Anonymous footer — visible on every state. */}
        <View style={styles.anonFooter}>
          <Lock size={12} color={compHexAlpha(compColors.community, 0.9)} />
          <Text style={styles.anonText}>
            {t('comparison.anonymous_footer')}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────── Dev-only state chip ───────────────────

const STATE_ORDER: readonly ComparisonState[] = [
  'full',
  'launch',
  'lowdata',
  'free',
] as const;

function cycleState(current: ComparisonState): ComparisonState {
  const i = STATE_ORDER.indexOf(current);
  return STATE_ORDER[(i + 1) % STATE_ORDER.length];
}

const STATE_LABEL: Record<ComparisonState, string> = {
  full: 'FULL',
  launch: 'LAUNCH',
  lowdata: 'LOW DATA',
  free: 'FREE',
};

function DevStateChip({
  state,
  onCycle,
  accentColor,
}: {
  state: ComparisonState;
  onCycle: () => void;
  accentColor: string;
}) {
  return (
    <Pressable
      onPress={onCycle}
      style={({ pressed }) => [
        styles.devChip,
        {
          borderColor: compHexAlpha(accentColor, 0.35),
          backgroundColor: compHexAlpha(accentColor, pressed ? 0.16 : 0.08),
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Cycle comparison state (currently ${STATE_LABEL[state]})`}
    >
      <Text style={[styles.devChipText, { color: compColors.textSecondary }]}>
        ◑ {STATE_LABEL[state]}
      </Text>
    </Pressable>
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
  devChip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  devChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 26,
    marginBottom: 12,
  },
  sectionKicker: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 2.3,
    color: compColors.textMuted,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(154,163,184,0.16)',
  },
  stack: {
    gap: 11,
  },
  anonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    opacity: 0.6,
  },
  anonText: {
    color: compColors.community,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
