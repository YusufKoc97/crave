/**
 * TEMP-COMPARISON-MOCK-DATA — 2026-07-22
 * -----------------------------------------------------------------
 * Design-preview mock data for the Comparison sub-tab.
 *
 * The design brief explicitly forbids fake community numbers in
 * production ("asla sahte community verisi üretme — Launch state
 * buna göre tasarlandı"). This module therefore stays gated
 * behind a TEMP marker: it powers the dev-only state cycler chip
 * so we can preview every state without a live backend, and
 * ships nothing to production callers.
 *
 * When the real `comparison-data` Edge Function lands, replace
 * the single `mockComparisonFor(state)` call inside
 * `ComparisonPane.tsx` with the query result; the shape below is
 * the target contract.
 *
 * REMOVE BEFORE SHIP: grep for TEMP-COMPARISON-MOCK-DATA and rip
 * out the import + fallback.
 * -----------------------------------------------------------------
 */

/** Four states the design brief cycles through in the dev chip. */
export type ComparisonState = 'full' | 'launch' | 'lowdata' | 'free';

/**
 * Pulse card — Community Pulse strip. All values here are the
 * "live" aggregate; ticker strings crossfade one-by-one.
 */
export type PulseData = {
  peopleThisWeek: number;
  cravingsResisted: number;
  topTrigger: { label: string; percent: number };
  ticker: string[];
};

/**
 * Distribution card — one You-vs-Community metric.
 * `tone: 'good'` puts a positive-delta chip in success green;
 * `tone: 'neutral'` (used by cravings/week) drops the percentile
 * line entirely per brief.
 */
export type DistributionMetric = {
  key: 'resistance_rate' | 'hold_out' | 'cravings_week';
  labelKey: string;
  icon: 'shield-check' | 'timer' | 'activity';
  youNum: number;
  suffix?: string;
  unit?: string;
  avg: number;
  avgLabel: string;
  sd: number;
  tone: 'good' | 'neutral';
  deltaLabel: string;
  note?: string;
};

/**
 * Standing card — the percentile hero.
 * `tone: 'high'` = trophy + accent, "top 25%" story.
 * `tone: 'low'` = trending-up + success green, "building momentum" story.
 */
export type StandingData = {
  percentPos: number; // 0..100 x-position of the user marker
  tone: 'high' | 'low';
};

/**
 * Community patterns — 3 read-only aggregate cards.
 * Values here are illustrative; real data would come from the
 * same Edge Function that powers Triggers.
 */
export type PatternsData = {
  clock: { startHour: number; endHour: number; sharePct: number };
  wave: { techniqueLabel: string; successPct: number };
  bar: {
    values: number[]; // length 7, Mon..Sun
    hardestDayIdx: number; // index into `values`
    labels: string[]; // ['M','T',...,'S']
  };
};

export type ComparisonData = {
  state: ComparisonState;
  pulse: PulseData;
  distribution: DistributionMetric[];
  standing: StandingData;
  patterns: PatternsData;
};

// ─────────────────────── FULL ───────────────────────
const MOCK_FULL: ComparisonData = {
  state: 'full',
  pulse: {
    peopleThisWeek: 1247,
    cravingsResisted: 8432,
    topTrigger: { label: 'Stress', percent: 41 },
    ticker: [
      'Someone resisted a craving 2 min ago',
      '14-min hold-out just logged',
      '3 people hit a new streak today',
    ],
  },
  distribution: [
    {
      key: 'resistance_rate',
      labelKey: 'comparison.metric.resistance_rate',
      icon: 'shield-check',
      youNum: 73,
      suffix: '%',
      avg: 61,
      avgLabel: '61%',
      sd: 15,
      tone: 'good',
      deltaLabel: '+12 pts',
    },
    {
      key: 'hold_out',
      labelKey: 'comparison.metric.hold_out',
      icon: 'timer',
      youNum: 14,
      unit: 'min',
      avg: 9,
      avgLabel: '9 min',
      sd: 5,
      tone: 'good',
      deltaLabel: '+5 min',
    },
    {
      key: 'cravings_week',
      labelKey: 'comparison.metric.cravings_week',
      icon: 'activity',
      youNum: 12,
      avg: 17,
      avgLabel: '17',
      sd: 6,
      tone: 'neutral',
      deltaLabel: '5 fewer',
      note: 'comparison.cravings_note',
    },
  ],
  standing: { percentPos: 78, tone: 'high' },
  patterns: {
    clock: { startHour: 19, endHour: 22, sharePct: 34 },
    wave: { techniqueLabel: 'Urge Surfing', successPct: 92 },
    bar: {
      values: [5, 12, 7, 6, 9, 4, 3],
      hardestDayIdx: 1,
      labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    },
  },
};

// ─────────────────────── LAUNCH ───────────────────────
// Ghost/aspirational — real numbers hidden, one honest fact.
const MOCK_LAUNCH: ComparisonData = {
  ...MOCK_FULL,
  state: 'launch',
  pulse: {
    // Only one real number in the Pulse; other counts still render
    // (the copy under them reads "first 500 resisters" style).
    peopleThisWeek: 500,
    cravingsResisted: 0,
    topTrigger: { label: 'Stress', percent: 0 },
    ticker: [
      'The lookout before sunrise',
      'Your community is forming',
      'Every craving logged counts',
    ],
  },
};

// ─────────────────── LOW PERSONAL DATA ───────────────────
// Community values real; user side is ghosted at render time.
const MOCK_LOWDATA: ComparisonData = {
  ...MOCK_FULL,
  state: 'lowdata',
};

// ─────────────────────── FREE ───────────────────────
// Same as FULL — Free state paints full content and lays the
// FreeGate blur+CTA on top.
const MOCK_FREE: ComparisonData = { ...MOCK_FULL, state: 'free' };

/** Return the mock dataset for a given cycler state. */
export function mockComparisonFor(state: ComparisonState): ComparisonData {
  switch (state) {
    case 'launch':
      return MOCK_LAUNCH;
    case 'lowdata':
      return MOCK_LOWDATA;
    case 'free':
      return MOCK_FREE;
    case 'full':
    default:
      return MOCK_FULL;
  }
}
