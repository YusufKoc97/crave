import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { useIsPremium } from '@/lib/premium';
import { useComparison } from '@/lib/comparison';
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
import { toComparisonData } from './mapResult';
import type { ComparisonData } from './__mockData';
// TEMP-COMPARISON-MOCK-DATA — mock powers ONLY the __DEV__ state
// cycler (design preview of full/launch/lowdata/free without seeding a
// live cohort). Production always renders real `comparison-data`
// output; when the dev chip is off (REAL), mock is never called.
import { mockComparisonFor, type ComparisonState } from './__mockData';

/**
 * Honest zeroed fallback while the real query is loading or the
 * function is unreachable — NEVER the mock's fabricated community
 * numbers. Renders the Launch panel with a 0 count ("community
 * forming"); distribution/standing/patterns don't paint in launch.
 */
const EMPTY_LAUNCH: ComparisonData = {
  state: 'launch',
  pulse: {
    peopleThisWeek: 0,
    cravingsResisted: 0,
    topTrigger: { label: t('comparison.pulse_no_trigger'), percent: 0 },
    ticker: [],
  },
  distribution: [],
  standing: { percentPos: 0, tone: 'low' },
  patterns: {
    clock: { startHour: 0, endHour: 3, sharePct: 0 },
    wave: { techniqueLabel: t('comparison.pulse_no_trigger'), successPct: 0 },
    bar: {
      values: [0, 0, 0, 0, 0, 0, 0],
      hardestDayIdx: 0,
      labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    },
  },
};

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
  const isPremium = useIsPremium();
  const query = useComparison(addiction.id);

  // Dev-only state cycler: null = REAL (live query), otherwise a
  // forced mock state for previewing layouts without a seeded cohort.
  const [devState, setDevState] = useState<ComparisonState | null>(null);

  // Real aggregate → render shape. Falls back to the honest zeroed
  // launch panel (never the mock's fake numbers) while loading / on
  // error. The __DEV__ chip can override with a mock state.
  const real = query.data ? toComparisonData(query.data, addiction.id) : null;
  const data: ComparisonData =
    __DEV__ && devState ? mockComparisonFor(devState) : (real ?? EMPTY_LAUNCH);

  // Premium overlay is a CLIENT concern, layered on top of the
  // backend's honesty state: a non-premium user's FULL view renders as
  // FREE (Pulse + Standing free; Distribution + Patterns gated).
  // launch / lowdata have no premium content to gate, so they pass
  // through untouched. In dev, a forced chip state previews verbatim.
  const forcedPreview = __DEV__ && !!devState;
  const effectiveState: ComparisonState = forcedPreview
    ? data.state
    : !isPremium && data.state === 'full'
      ? 'free'
      : data.state;

  const isLowData = effectiveState === 'lowdata';
  const isLaunch = effectiveState === 'launch';
  const isFree = effectiveState === 'free';
  const isFull = effectiveState === 'full';

  // ── Composable blocks (order differs between FULL and FREE) ──
  const distributionBlock = (
    <>
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
    </>
  );

  const standingBlock = (
    <View style={{ marginTop: 20 }}>
      <StandingCard addiction={addiction} data={data.standing} />
    </View>
  );

  const patternsBlock = (
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
  );

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
            state={devState}
            onCycle={() => setDevState(cycleDevState(devState))}
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
        ) : isFree ? (
          // FREE funnel: Standing teaser stays crisp (the free hook —
          // "you're in the top X%"), then the deep-dive (Distribution
          // + Patterns) sits under ONE gate with a single CTA.
          <>
            {standingBlock}
            <View style={{ marginTop: 20 }}>
              <FreeGate addiction={addiction}>
                {distributionBlock}
                {patternsBlock}
              </FreeGate>
            </View>
          </>
        ) : isFull ? (
          <>
            {distributionBlock}
            {standingBlock}
            {patternsBlock}
          </>
        ) : (
          // lowdata: ghosted distribution only (no standing/patterns).
          distributionBlock
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

// null = REAL (live query); the rest force a mock preview state.
const DEV_ORDER: readonly (ComparisonState | null)[] = [
  null,
  'full',
  'launch',
  'lowdata',
  'free',
] as const;

function cycleDevState(
  current: ComparisonState | null
): ComparisonState | null {
  const i = DEV_ORDER.indexOf(current);
  return DEV_ORDER[(i + 1) % DEV_ORDER.length];
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
  state: ComparisonState | null;
  onCycle: () => void;
  accentColor: string;
}) {
  const label = state ? STATE_LABEL[state] : 'REAL';
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
      accessibilityLabel={`Cycle comparison state (currently ${label})`}
    >
      <Text style={[styles.devChipText, { color: compColors.textSecondary }]}>
        ◑ {label}
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
