/**
 * Cross-runtime community-comparison aggregation — pure TypeScript,
 * no runtime imports, so both Vitest (Node) and the Deno Edge Function
 * (`comparison-data`) share ONE implementation.
 *
 * The Comparison tab answers "how am I doing vs everyone else fighting
 * this addiction?". This module takes the raw cohort rows the Edge
 * Function fetches (all users' resolved sessions for one addiction,
 * their triggers, their technique feedback) and reduces them into the
 * numeric payload the client renders — percentile standing, you-vs-avg
 * distribution, community pulse, and community patterns.
 *
 * Privacy + honesty guards live here, NOT in the UI:
 *   - cohort < MIN_COHORT_USERS  → state 'launch' (no real numbers; a
 *     3-person "community" both means nothing statistically AND can
 *     de-anonymise those people). The threshold is a tunable dial.
 *   - requester has < MIN_SESSIONS_TO_PLACE resolved sessions → state
 *     'lowdata' (community shows, but the user's own placement is not
 *     asserted from a noisy 1-session rate).
 * Only users clearing MIN_SESSIONS_TO_PLACE are "placed" in the
 * distribution/percentile math, so a flood of 1-session accounts can't
 * distort the curve.
 *
 * Label mapping (trigger_id / technique_id → display text) is NOT done
 * here — it is locale-dependent and stays on the client, matching how
 * the Triggers pane maps ids. This module emits ids + numbers only.
 */

/** Below this many distinct cohort users, show 'launch' — never a
 *  fabricated community number. Tunable; 30 is the conventional
 *  small-sample floor where a distribution starts to mean something. */
export const MIN_COHORT_USERS = 30;

/** A user needs at least this many resolved sessions before their
 *  resistance rate is trusted enough to place on the curve (or to
 *  assert the requester's own standing). */
export const MIN_SESSIONS_TO_PLACE = 5;

/** One resolved craving row from ANY user in the cohort. */
export type CohortSession = {
  id: string;
  user_id: string;
  outcome: 'resisted' | 'failed';
  duration_seconds: number;
  started_at: string; // ISO
};

/** Trigger tag on a cohort session (join row). */
export type CohortTriggerRow = { session_id: string; trigger_id: string };

/** Completed technique-use feedback from a cohort user. */
export type CohortTechRow = {
  technique_id: string;
  feedback: 'much_better' | 'better' | 'same' | 'worse' | null;
};

export type ComparisonState = 'full' | 'launch' | 'lowdata';

export type DistributionStat = {
  key: 'resistance_rate' | 'hold_out' | 'cravings_week';
  youNum: number;
  avg: number;
  sd: number;
  tone: 'good' | 'neutral';
  /** signed delta of youNum vs avg, already rounded */
  delta: number;
};

export type ComparisonStatsResult = {
  state: ComparisonState;
  cohortUsers: number;
  pulse: {
    peopleThisWeek: number;
    cravingsResisted: number;
    /** null when there are no tagged triggers this week */
    topTrigger: { triggerId: string; percent: number } | null;
  };
  distribution: DistributionStat[];
  standing: { percentPos: number; tone: 'high' | 'low' };
  patterns: {
    clock: { startHour: number; endHour: number; sharePct: number };
    wave: { techniqueId: string; successPct: number } | null;
    /** 7 counts, index 0 = Monday … 6 = Sunday */
    bar: { values: number[]; hardestDayIdx: number };
  };
};

const WEEK_MS = 7 * 24 * 60 * 60_000;

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population standard deviation (0 for <2 points). */
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
  return Math.sqrt(v);
}

/** Mon-based day index: Sun(0)→6, Mon(1)→0 … Sat(6)→5. */
function mondayIndex(iso: string): number {
  return (new Date(iso).getDay() + 6) % 7;
}

type PerUser = {
  total: number;
  resisted: number;
  holdoutSecSum: number; // over resisted only
  cravingsWeek: number; // sessions started within the trailing week
};

/**
 * Reduce raw cohort rows into the comparison payload for one requester.
 * `nowMs` is injected so the "this week" window is pure/testable.
 */
export function computeComparison(args: {
  requesterId: string;
  sessions: CohortSession[];
  triggers: CohortTriggerRow[];
  techniques: CohortTechRow[];
  nowMs: number;
}): ComparisonStatsResult {
  const { requesterId, sessions, triggers, techniques, nowMs } = args;
  const weekCutoff = nowMs - WEEK_MS;

  // ── Per-user roll-up ──
  const perUser = new Map<string, PerUser>();
  for (const s of sessions) {
    const u = perUser.get(s.user_id) ?? {
      total: 0,
      resisted: 0,
      holdoutSecSum: 0,
      cravingsWeek: 0,
    };
    u.total += 1;
    if (s.outcome === 'resisted') {
      u.resisted += 1;
      u.holdoutSecSum += s.duration_seconds;
    }
    if (Date.parse(s.started_at) >= weekCutoff) u.cravingsWeek += 1;
    perUser.set(s.user_id, u);
  }

  const cohortUsers = perUser.size;

  // Placed = enough sessions to trust the rate. These drive every
  // cohort statistic below.
  const placed = [...perUser.values()].filter(
    (u) => u.total >= MIN_SESSIONS_TO_PLACE
  );
  const resistRates = placed.map((u) => u.resisted / u.total);
  const holdoutMins = placed
    .filter((u) => u.resisted > 0)
    .map((u) => u.holdoutSecSum / u.resisted / 60);
  const cravingsWeeks = placed.map((u) => u.cravingsWeek);

  const avgRate = mean(resistRates);
  const sdRate = stdev(resistRates);
  const avgHoldout = mean(holdoutMins);
  const sdHoldout = stdev(holdoutMins);
  const avgCravings = mean(cravingsWeeks);
  const sdCravings = stdev(cravingsWeeks);

  // ── Requester slice ──
  const me = perUser.get(requesterId);
  const myPlaced = !!me && me.total >= MIN_SESSIONS_TO_PLACE;
  const myRate = me && me.total > 0 ? me.resisted / me.total : 0;
  const myHoldoutMin =
    me && me.resisted > 0 ? me.holdoutSecSum / me.resisted / 60 : 0;
  const myCravingsWeek = me ? me.cravingsWeek : 0;

  // Percentile: share of placed users at or below my rate. Only
  // meaningful when I'm placed; otherwise reported as 0 and the state
  // downgrades to 'lowdata' so the UI ghosts it.
  const atOrBelow = resistRates.filter((r) => r <= myRate).length;
  const percentPos =
    myPlaced && resistRates.length > 0
      ? Math.round((atOrBelow / resistRates.length) * 100)
      : 0;

  // ── State ──
  const state: ComparisonState =
    cohortUsers < MIN_COHORT_USERS ? 'launch' : myPlaced ? 'full' : 'lowdata';

  // ── Pulse (trailing week, whole cohort) ──
  const weekSessions = sessions.filter(
    (s) => Date.parse(s.started_at) >= weekCutoff
  );
  const peopleThisWeek = new Set(weekSessions.map((s) => s.user_id)).size;
  const cravingsResisted = weekSessions.filter(
    (s) => s.outcome === 'resisted'
  ).length;

  const weekSessionIds = new Set(weekSessions.map((s) => s.id));
  const weekTriggerCounts = new Map<string, number>();
  let weekTriggerTotal = 0;
  for (const tr of triggers) {
    if (!weekSessionIds.has(tr.session_id)) continue;
    weekTriggerCounts.set(
      tr.trigger_id,
      (weekTriggerCounts.get(tr.trigger_id) ?? 0) + 1
    );
    weekTriggerTotal += 1;
  }
  let topTrigger: { triggerId: string; percent: number } | null = null;
  for (const [triggerId, count] of weekTriggerCounts) {
    if (!topTrigger || count > weekTriggerCounts.get(topTrigger.triggerId)!) {
      topTrigger = {
        triggerId,
        percent: Math.round((count / weekTriggerTotal) * 100),
      };
    }
  }

  // ── Distribution (rounded, display-ready numbers) ──
  const distribution: DistributionStat[] = [
    {
      key: 'resistance_rate',
      youNum: Math.round(myRate * 100),
      avg: Math.round(avgRate * 100),
      sd: Math.round(sdRate * 100),
      tone: myRate >= avgRate ? 'good' : 'neutral',
      delta: Math.round((myRate - avgRate) * 100),
    },
    {
      key: 'hold_out',
      youNum: Math.round(myHoldoutMin),
      avg: Math.round(avgHoldout),
      sd: Math.round(sdHoldout),
      tone: myHoldoutMin >= avgHoldout ? 'good' : 'neutral',
      delta: Math.round(myHoldoutMin - avgHoldout),
    },
    {
      // Fewer cravings is "better" but we don't assert a percentile on
      // it (a low count can mean a calm week OR an untracked one), so
      // tone stays neutral per the design brief.
      key: 'cravings_week',
      youNum: myCravingsWeek,
      avg: Math.round(avgCravings),
      sd: Math.round(sdCravings),
      tone: 'neutral',
      delta: Math.round(myCravingsWeek - avgCravings),
    },
  ];

  // ── Patterns (whole cohort) ──
  // clock: peak 3-hour window by session volume.
  const hourHist = new Array(24).fill(0);
  const dayHist = new Array(7).fill(0);
  for (const s of sessions) {
    hourHist[new Date(s.started_at).getHours()] += 1;
    dayHist[mondayIndex(s.started_at)] += 1;
  }
  const totalForClock = sessions.length;
  let bestStart = 0;
  let bestWindow = -1;
  for (let h = 0; h < 24; h++) {
    const windowCount =
      hourHist[h] + hourHist[(h + 1) % 24] + hourHist[(h + 2) % 24];
    // Strictly bigger window wins; on a tie prefer the one whose START
    // hour is busiest, so the window never opens on an empty hour.
    if (
      windowCount > bestWindow ||
      (windowCount === bestWindow && hourHist[h] > hourHist[bestStart])
    ) {
      bestWindow = windowCount;
      bestStart = h;
    }
  }
  const clock = {
    startHour: bestStart,
    endHour: (bestStart + 3) % 24,
    sharePct:
      totalForClock > 0 ? Math.round((bestWindow / totalForClock) * 100) : 0,
  };

  // wave: technique with the highest success share (much_better|better),
  // among techniques with enough uses to be trustworthy.
  const techAgg = new Map<string, { success: number; total: number }>();
  for (const t of techniques) {
    const a = techAgg.get(t.technique_id) ?? { success: 0, total: 0 };
    a.total += 1;
    if (t.feedback === 'much_better' || t.feedback === 'better') a.success += 1;
    techAgg.set(t.technique_id, a);
  }
  let wave: { techniqueId: string; successPct: number } | null = null;
  for (const [techniqueId, a] of techAgg) {
    if (a.total < MIN_SESSIONS_TO_PLACE) continue;
    const pct = Math.round((a.success / a.total) * 100);
    if (!wave || pct > wave.successPct) wave = { techniqueId, successPct: pct };
  }

  let hardestDayIdx = 0;
  for (let d = 1; d < 7; d++)
    if (dayHist[d] > dayHist[hardestDayIdx]) hardestDayIdx = d;

  return {
    state,
    cohortUsers,
    pulse: { peopleThisWeek, cravingsResisted, topTrigger },
    distribution,
    standing: { percentPos, tone: percentPos >= 50 ? 'high' : 'low' },
    patterns: { clock, wave, bar: { values: dayHist, hardestDayIdx } },
  };
}
