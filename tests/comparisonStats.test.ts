import { describe, expect, it } from 'vitest';
import {
  computeComparison,
  MIN_COHORT_USERS,
  MIN_SESSIONS_TO_PLACE,
  type CohortSession,
  type CohortTechRow,
  type CohortTriggerRow,
} from '@/shared/comparisonStats';

/**
 * Comparison aggregation contract. These lock the privacy/honesty
 * guards (launch / lowdata) and the percentile + distribution math the
 * `comparison-data` Edge Function will run server-side.
 */

const NOW = new Date('2026-08-14T12:00:00Z').getTime();
// Within the trailing week, kept as a local-time string so hour/day
// derivations (getHours/getDay) are deterministic across runners.
const RECENT = '2026-08-13T20:30:00';

function sessionsFor(
  userId: string,
  total: number,
  resisted: number,
  opts: { holdoutSec?: number; startedAt?: string } = {}
): CohortSession[] {
  const holdoutSec = opts.holdoutSec ?? 600; // 10 min
  const startedAt = opts.startedAt ?? RECENT;
  return Array.from({ length: total }, (_, i) => ({
    id: `${userId}-${i}`,
    user_id: userId,
    outcome: i < resisted ? ('resisted' as const) : ('failed' as const),
    duration_seconds: holdoutSec,
    started_at: startedAt,
  }));
}

/** N users each with `per` sessions at a fixed resist ratio. */
function cohort(
  n: number,
  per: number,
  resisted: number,
  prefix = 'u'
): CohortSession[] {
  const out: CohortSession[] = [];
  for (let u = 0; u < n; u++)
    out.push(...sessionsFor(`${prefix}${u}`, per, resisted));
  return out;
}

describe('cohort privacy guard (launch)', () => {
  it('below MIN_COHORT_USERS distinct users → launch, no percentile', () => {
    const sessions = cohort(MIN_COHORT_USERS - 1, 10, 6);
    const r = computeComparison({
      requesterId: 'u0',
      sessions,
      triggers: [],
      techniques: [],
      nowMs: NOW,
    });
    expect(r.state).toBe('launch');
    expect(r.cohortUsers).toBe(MIN_COHORT_USERS - 1);
  });
});

describe('percentile standing (full)', () => {
  // 30 users: three tiers of resist rate 0.3 / 0.6 / 0.9, 10 each.
  const sessions = [
    ...cohort(10, 10, 3, 'lo'),
    ...cohort(10, 10, 6, 'mid'),
    ...cohort(10, 10, 9, 'hi'),
  ];

  it('top-tier requester lands at the top of the curve', () => {
    const r = computeComparison({
      requesterId: 'hi0',
      sessions,
      triggers: [],
      techniques: [],
      nowMs: NOW,
    });
    expect(r.state).toBe('full');
    expect(r.cohortUsers).toBe(30);
    expect(r.standing.percentPos).toBe(100); // all 30 rates <= 0.9
    expect(r.standing.tone).toBe('high');
  });

  it('mid-tier requester sits at the two-thirds mark', () => {
    const r = computeComparison({
      requesterId: 'mid0',
      sessions,
      triggers: [],
      techniques: [],
      nowMs: NOW,
    });
    // 20 of 30 users (lo + mid) are at or below 0.6.
    expect(r.standing.percentPos).toBe(67);
  });

  it('distribution reports you-vs-average with a signed delta', () => {
    const r = computeComparison({
      requesterId: 'hi0',
      sessions,
      triggers: [],
      techniques: [],
      nowMs: NOW,
    });
    const rate = r.distribution.find((d) => d.key === 'resistance_rate')!;
    expect(rate.youNum).toBe(90);
    expect(rate.avg).toBe(60); // mean of 30/60/90
    expect(rate.delta).toBe(30);
    expect(rate.tone).toBe('good');
  });
});

describe('personal-data guard (lowdata)', () => {
  it('requester under MIN_SESSIONS_TO_PLACE → lowdata, percentile ghosted', () => {
    const sessions = [
      ...cohort(30, 10, 6),
      ...sessionsFor('me', MIN_SESSIONS_TO_PLACE - 1, 2),
    ];
    const r = computeComparison({
      requesterId: 'me',
      sessions,
      triggers: [],
      techniques: [],
      nowMs: NOW,
    });
    expect(r.state).toBe('lowdata');
    expect(r.standing.percentPos).toBe(0);
    expect(r.cohortUsers).toBe(31);
  });
});

describe('pulse (trailing week)', () => {
  it('counts only this-week sessions and the top tagged trigger', () => {
    const old = '2026-01-01T10:00:00'; // far outside the week
    const sessions = [
      ...sessionsFor('a', 4, 3, { startedAt: RECENT }),
      ...sessionsFor('b', 2, 2, { startedAt: RECENT }),
      ...sessionsFor('c', 5, 0, { startedAt: old }), // ignored by pulse
    ];
    const triggers: CohortTriggerRow[] = [
      { session_id: 'a-0', trigger_id: 'stress' },
      { session_id: 'a-1', trigger_id: 'stress' },
      { session_id: 'b-0', trigger_id: 'boredom' },
      { session_id: 'c-0', trigger_id: 'stress' }, // old session → excluded
    ];
    const r = computeComparison({
      requesterId: 'a',
      sessions,
      triggers,
      techniques: [],
      nowMs: NOW,
    });
    expect(r.pulse.peopleThisWeek).toBe(2); // a + b (c is old)
    expect(r.pulse.cravingsResisted).toBe(5); // a:3 + b:2
    expect(r.pulse.topTrigger).toEqual({ triggerId: 'stress', percent: 67 }); // 2 of 3 week-triggers
  });
});

describe('community patterns', () => {
  it('clock finds the peak 3-hour window; bar finds the hardest day', () => {
    // Sun 2026-08-09 (Mon-idx 6) at 20:00, plus Tue at 09:00.
    const sessions: CohortSession[] = [
      ...sessionsFor('a', 3, 3, { startedAt: '2026-08-09T20:15:00' }),
      ...sessionsFor('b', 1, 1, { startedAt: '2026-08-09T21:15:00' }),
      ...sessionsFor('c', 1, 0, { startedAt: '2026-08-11T09:15:00' }),
    ];
    const r = computeComparison({
      requesterId: 'a',
      sessions,
      triggers: [],
      techniques: [],
      nowMs: NOW,
    });
    // 4 of 5 sessions fall in the 20:00–22:00 window.
    expect(r.patterns.clock.startHour).toBe(20);
    expect(r.patterns.clock.endHour).toBe(23);
    expect(r.patterns.clock.sharePct).toBe(80);
    // Sunday (Mon-index 6) has the most sessions.
    expect(r.patterns.bar.hardestDayIdx).toBe(6);
    expect(r.patterns.bar.values[6]).toBe(4);
  });

  it('wave picks the winningest technique above the min-use floor', () => {
    const techniques: CohortTechRow[] = [
      ...Array.from({ length: 8 }, (_, i) => ({
        technique_id: 'urge_surf',
        feedback: (i < 7
          ? 'much_better'
          : 'worse') as CohortTechRow['feedback'],
      })),
      ...Array.from({ length: 6 }, () => ({
        technique_id: 'breathing',
        feedback: 'same' as CohortTechRow['feedback'],
      })),
      // Too few uses to be trusted, even at 100% success.
      { technique_id: 'grounding', feedback: 'much_better' },
    ];
    const r = computeComparison({
      requesterId: 'a',
      sessions: sessionsFor('a', 5, 3),
      triggers: [],
      techniques,
      nowMs: NOW,
    });
    expect(r.patterns.wave).toEqual({
      techniqueId: 'urge_surf',
      successPct: 88,
    });
  });
});
