import { describe, expect, it } from 'vitest';
import {
  INSIGHT_RULES,
  MAX_INSIGHTS,
  evaluateInsights,
  type InsightData,
  type RuleSession,
  type RuleTechniqueUse,
} from '@/shared/insightRules';

/**
 * Faz 8b — rule engine tests. One describe per rule, plus one
 * for the evaluator's sort + slice behaviour.
 *
 * All rules are gated on `minCravings`, so every fixture builds
 * at least that many sessions. Fixtures use a fixed `now` for
 * deterministic outputs across CI.
 */

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0); // Jun 15 2026 (arbitrary)
const DAY_MS = 24 * 60 * 60_000;

/** Build an ISO N days ago from NOW, at hour `hour`. */
function isoAgo(days: number, hour = 12): string {
  const t = NOW - days * DAY_MS;
  const d = new Date(t);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function sessionAt(
  days: number,
  hour: number,
  outcome: RuleSession['outcome']
): RuleSession {
  return { started_at: isoAgo(days, hour), outcome };
}

function emptyData(overrides: Partial<InsightData> = {}): InsightData {
  return {
    cravings: [],
    techniqueUses: [],
    triggerCounts: {},
    hourlyDistribution: {},
    dailyDistribution: {},
    daysSinceLastCraving: Number.POSITIVE_INFINITY,
    now: NOW,
    ...overrides,
  };
}

function ruleById(id: string) {
  const rule = INSIGHT_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`unknown rule ${id}`);
  return rule;
}

describe('peak_hour rule', () => {
  it('fires when one hour is ≥ 2× the average hour', () => {
    // 20 cravings, 12 of them at hour 19. avg = 20/24 ≈ 0.83.
    // peak = 12 > 2 × 0.83.
    const cravings: RuleSession[] = Array.from({ length: 20 }, (_, i) =>
      sessionAt(i, i < 12 ? 19 : 3, 'resisted')
    );
    const hourly: Record<number, number> = { 19: 12, 3: 8 };
    const match = ruleById('peak_hour').evaluate(
      emptyData({ cravings, hourlyDistribution: hourly })
    );
    expect(match?.interpolation.hour).toBe('19:00');
    expect(match?.interpolation.count).toBe(12);
  });

  it('does not fire when peak is only marginally above average', () => {
    // 30 evenly distributed, peak=2 → avg=1.25, 2×avg=2.5, 2 < 2.5.
    const cravings = Array.from({ length: 30 }, (_, i) =>
      sessionAt(i, i % 24, 'resisted')
    );
    const hourly: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourly[h] = 1;
    hourly[10] = 2; // 2 vs 2×avg (2.5) → not enough
    hourly[11] = 2;
    hourly[12] = 2;
    hourly[13] = 2;
    hourly[14] = 2;
    hourly[15] = 2; // 6 doubled cells, 18 singles → 30 total, avg=1.25
    const match = ruleById('peak_hour').evaluate(
      emptyData({ cravings, hourlyDistribution: hourly })
    );
    expect(match).toBeNull();
  });

  it('pads single-digit hours with a leading zero', () => {
    const cravings = Array.from({ length: 10 }, () =>
      sessionAt(0, 3, 'resisted')
    );
    const hourly: Record<number, number> = { 3: 10 };
    const match = ruleById('peak_hour').evaluate(
      emptyData({ cravings, hourlyDistribution: hourly })
    );
    expect(match?.interpolation.hour).toBe('03:00');
  });
});

describe('dominant_trigger rule', () => {
  it('fires when one trigger accounts for ≥ 35% of hits', () => {
    const match = ruleById('dominant_trigger').evaluate(
      emptyData({
        cravings: Array.from({ length: 10 }, () =>
          sessionAt(0, 12, 'resisted')
        ),
        triggerCounts: { stress: 5, boredom: 3, loneliness: 2 },
      })
    );
    expect(match?.interpolation.trigger).toBe('stress');
    expect(match?.interpolation.percent).toBe(50);
    expect(match?.actionKey).toBe('open_toolkit');
  });

  it('does not fire when the top trigger is below 35%', () => {
    const match = ruleById('dominant_trigger').evaluate(
      emptyData({
        cravings: Array.from({ length: 10 }, () =>
          sessionAt(0, 12, 'resisted')
        ),
        triggerCounts: { stress: 3, boredom: 3, loneliness: 2, anger: 2 },
      })
    );
    expect(match).toBeNull();
  });

  it('returns null when there are no triggers at all', () => {
    const match = ruleById('dominant_trigger').evaluate(
      emptyData({
        cravings: Array.from({ length: 10 }, () =>
          sessionAt(0, 12, 'resisted')
        ),
      })
    );
    expect(match).toBeNull();
  });
});

describe('effective_technique rule', () => {
  it('fires when a technique has ≥ 5 uses and 80%+ positive feedback', () => {
    const uses: RuleTechniqueUse[] = [
      { technique_id: 'breathing_478', feedback: 'much_better' },
      { technique_id: 'breathing_478', feedback: 'much_better' },
      { technique_id: 'breathing_478', feedback: 'better' },
      { technique_id: 'breathing_478', feedback: 'better' },
      { technique_id: 'breathing_478', feedback: 'better' },
      { technique_id: 'breathing_478', feedback: 'same' }, // 5/6 = 83%
    ];
    const match = ruleById('effective_technique').evaluate(
      emptyData({
        cravings: Array.from({ length: 6 }, () => sessionAt(0, 12, 'resisted')),
        techniqueUses: uses,
      })
    );
    expect(match?.interpolation.technique).toBe('breathing_478');
    expect(match?.interpolation.percent).toBe(83);
  });

  it('ignores techniques with fewer than 5 uses', () => {
    const uses: RuleTechniqueUse[] = [
      { technique_id: 'breathing_478', feedback: 'much_better' },
      { technique_id: 'breathing_478', feedback: 'much_better' },
      { technique_id: 'breathing_478', feedback: 'much_better' },
      { technique_id: 'breathing_478', feedback: 'much_better' }, // only 4
    ];
    const match = ruleById('effective_technique').evaluate(
      emptyData({
        cravings: Array.from({ length: 6 }, () => sessionAt(0, 12, 'resisted')),
        techniqueUses: uses,
      })
    );
    expect(match).toBeNull();
  });

  it('does not fire when positive ratio < 80%', () => {
    const uses: RuleTechniqueUse[] = [
      { technique_id: 'urge_surfing', feedback: 'better' },
      { technique_id: 'urge_surfing', feedback: 'better' },
      { technique_id: 'urge_surfing', feedback: 'better' },
      { technique_id: 'urge_surfing', feedback: 'same' },
      { technique_id: 'urge_surfing', feedback: 'worse' }, // 3/5 = 60%
    ];
    const match = ruleById('effective_technique').evaluate(
      emptyData({
        cravings: Array.from({ length: 6 }, () => sessionAt(0, 12, 'resisted')),
        techniqueUses: uses,
      })
    );
    expect(match).toBeNull();
  });
});

describe('weekend_concentration rule', () => {
  it('fires when weekend average is ≥ 1.5× weekday average', () => {
    // 6 sat, 6 sun, 2 per weekday (10 total) → weekendAvg=6 weekdayAvg=2 → 3.0×
    const match = ruleById('weekend_concentration').evaluate(
      emptyData({
        cravings: Array.from({ length: 22 }, () =>
          sessionAt(0, 12, 'resisted')
        ),
        dailyDistribution: { 0: 6, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 6 },
      })
    );
    expect(match?.interpolation.multiplier).toBe('3.0');
  });

  it('does not fire when weekends match weekdays', () => {
    const match = ruleById('weekend_concentration').evaluate(
      emptyData({
        cravings: Array.from({ length: 14 }, () =>
          sessionAt(0, 12, 'resisted')
        ),
        dailyDistribution: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 },
      })
    );
    expect(match).toBeNull();
  });

  it('returns null when weekdays are all zero (avoids div by zero)', () => {
    const match = ruleById('weekend_concentration').evaluate(
      emptyData({
        cravings: Array.from({ length: 14 }, () =>
          sessionAt(0, 12, 'resisted')
        ),
        dailyDistribution: { 0: 7, 6: 7 },
      })
    );
    expect(match).toBeNull();
  });
});

describe('rising_resistance rule', () => {
  it('fires when recent 7d success rate is ≥ 15pp higher than prior 7d', () => {
    // prior 7d: 5 sessions, 1 resisted (20%)
    // recent 7d: 5 sessions, 4 resisted (80%)
    // delta = 0.6 ≥ 0.15
    const recent: RuleSession[] = [
      sessionAt(1, 12, 'resisted'),
      sessionAt(2, 12, 'resisted'),
      sessionAt(3, 12, 'resisted'),
      sessionAt(4, 12, 'resisted'),
      sessionAt(5, 12, 'failed'),
    ];
    const prior: RuleSession[] = [
      sessionAt(8, 12, 'resisted'),
      sessionAt(9, 12, 'failed'),
      sessionAt(10, 12, 'failed'),
      sessionAt(11, 12, 'failed'),
      sessionAt(12, 12, 'failed'),
    ];
    const match = ruleById('rising_resistance').evaluate(
      emptyData({ cravings: [...recent, ...prior] })
    );
    expect(match?.interpolation.percent).toBe(60);
  });

  it('does not fire when recent window has fewer than 5 sessions', () => {
    const match = ruleById('rising_resistance').evaluate(
      emptyData({
        cravings: [
          sessionAt(1, 12, 'resisted'),
          sessionAt(2, 12, 'resisted'), // only 2 recent
          sessionAt(8, 12, 'failed'),
          sessionAt(9, 12, 'failed'),
          sessionAt(10, 12, 'failed'),
          sessionAt(11, 12, 'failed'),
          sessionAt(12, 12, 'failed'),
        ],
      })
    );
    expect(match).toBeNull();
  });

  it('does not fire when improvement is under 15pp', () => {
    // recent 5/5 = 100%, prior 4/5 = 80%, delta 0.2 — matches
    // now recent 4/5 = 80%, prior 4/5 = 80%, delta 0 — no match
    const match = ruleById('rising_resistance').evaluate(
      emptyData({
        cravings: [
          sessionAt(1, 12, 'resisted'),
          sessionAt(2, 12, 'resisted'),
          sessionAt(3, 12, 'resisted'),
          sessionAt(4, 12, 'resisted'),
          sessionAt(5, 12, 'failed'),
          sessionAt(8, 12, 'resisted'),
          sessionAt(9, 12, 'resisted'),
          sessionAt(10, 12, 'resisted'),
          sessionAt(11, 12, 'resisted'),
          sessionAt(12, 12, 'failed'),
        ],
      })
    );
    expect(match).toBeNull();
  });
});

describe('silence_check rule', () => {
  it('fires between 2 and 7 days since last craving', () => {
    const match = ruleById('silence_check').evaluate(
      emptyData({
        cravings: Array.from({ length: 6 }, (_, i) =>
          sessionAt(i + 4, 12, 'resisted')
        ),
        daysSinceLastCraving: 3,
      })
    );
    expect(match?.interpolation.days).toBe(3);
  });

  it('does not fire when the last craving was under 2 days ago', () => {
    const match = ruleById('silence_check').evaluate(
      emptyData({
        cravings: Array.from({ length: 6 }, () => sessionAt(0, 12, 'resisted')),
        daysSinceLastCraving: 1,
      })
    );
    expect(match).toBeNull();
  });

  it('does not fire past 7 days (that is a different signal)', () => {
    const match = ruleById('silence_check').evaluate(
      emptyData({
        cravings: Array.from({ length: 6 }, () => sessionAt(0, 12, 'resisted')),
        daysSinceLastCraving: 10,
      })
    );
    expect(match).toBeNull();
  });

  it('is a no-op when there is no history (Infinity)', () => {
    const match = ruleById('silence_check').evaluate(
      emptyData({
        cravings: Array.from({ length: 6 }, () => sessionAt(0, 12, 'resisted')),
        daysSinceLastCraving: Number.POSITIVE_INFINITY,
      })
    );
    expect(match).toBeNull();
  });
});

describe('evaluateInsights', () => {
  it('returns an empty array when no rule fires', () => {
    const out = evaluateInsights(emptyData());
    expect(out).toEqual([]);
  });

  it(`caps output at MAX_INSIGHTS (${MAX_INSIGHTS}) rules`, () => {
    // Craft data that makes every rule fire — then the evaluator
    // should still only surface the top MAX_INSIGHTS by priority.
    const cravings: RuleSession[] = [
      // Recent window (last 7d) — 5 resists to satisfy rising_resistance
      ...Array.from({ length: 5 }, (_, i) => sessionAt(i + 1, 19, 'resisted')),
      // Prior window (days 8-14) — 5 failures for the delta
      ...Array.from({ length: 5 }, (_, i) => sessionAt(i + 8, 19, 'failed')),
      // Extras for count thresholds
      ...Array.from({ length: 6 }, () => sessionAt(0, 19, 'resisted')),
    ];
    const hourly: Record<number, number> = { 19: 16 }; // dominates
    const daily: Record<number, number> = {
      0: 6,
      1: 1,
      2: 1,
      3: 1,
      4: 1,
      5: 1,
      6: 6,
    };
    const uses: RuleTechniqueUse[] = Array.from({ length: 5 }, () => ({
      technique_id: 'breathing_478',
      feedback: 'much_better',
    }));
    const out = evaluateInsights(
      emptyData({
        cravings,
        hourlyDistribution: hourly,
        dailyDistribution: daily,
        triggerCounts: { stress: 10, boredom: 2 },
        techniqueUses: uses,
        daysSinceLastCraving: 3,
      })
    );
    expect(out.length).toBeLessThanOrEqual(MAX_INSIGHTS);
    // Sorted by priority descending.
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].priority).toBeGreaterThanOrEqual(out[i].priority);
    }
    // Top slot must be the highest priority rule that fired
    // (dominant_trigger = 90).
    expect(out[0].rule_id).toBe('dominant_trigger');
  });

  it('respects each rule.minCravings gate', () => {
    // 4 cravings → no rule with minCravings ≥ 5 should evaluate,
    // so effectively no insights.
    const out = evaluateInsights(
      emptyData({
        cravings: Array.from({ length: 4 }, () => sessionAt(0, 12, 'resisted')),
        triggerCounts: { stress: 4 }, // 100% dominant, but data too thin
      })
    );
    expect(out).toEqual([]);
  });

  it('breaks priority ties deterministically by rule_id', () => {
    // No real tie exists among the 6 default rules, but the
    // evaluator's tiebreak logic still needs to be pure. Verify
    // the output ordering is stable by running twice.
    const data = emptyData({
      cravings: Array.from({ length: 20 }, () => sessionAt(0, 19, 'resisted')),
      hourlyDistribution: { 19: 20 },
    });
    const a = evaluateInsights(data);
    const b = evaluateInsights(data);
    expect(a.map((i) => i.rule_id)).toEqual(b.map((i) => i.rule_id));
  });
});
