/**
 * Cross-runtime insights engine — pure TypeScript, no imports.
 *
 * The 6 rules and the evaluator live here so the Edge Function
 * (Deno) and Vitest (Node) pull in the same source. The client
 * never runs the rules itself — it only renders the server's
 * `insights` array — but the *types* below are also the wire
 * schema and are re-exported through `lib/triggerMap.ts`.
 *
 * Design rules:
 *   • Independent windows. Each rule defines its own time slice
 *     internally; the caller passes the FULL history plus a few
 *     precomputed distributions. The Trigger Map's period picker
 *     (7d/30d/all) does NOT filter insights — heatmap only.
 *   • Raw IDs in interpolation. `trigger` and `technique` values
 *     are IDs (e.g. `stress`, `breathing_478`) — the client swaps
 *     them for i18n labels at render time so translation changes
 *     don't require a function redeploy.
 *   • Top 3 by priority. Ties resolve to earlier array position
 *     (i.e. lower rule.id lexicographically — deterministic).
 */

export type InsightCategory = 'time' | 'trigger' | 'technique' | 'trend';

/** Session shape the rules need — a minimal projection. */
export interface RuleSession {
  started_at: string; // ISO
  outcome: 'resisted' | 'failed' | null; // null = still active (skipped)
}

/** Technique-use shape the rules need — again minimal. */
export interface RuleTechniqueUse {
  technique_id: string;
  feedback: 'much_better' | 'better' | 'same' | 'worse' | null;
}

/**
 * Aggregate the caller must build before calling `evaluateInsights`.
 *
 * `hourlyDistribution` / `dailyDistribution` are computed across
 * ALL `cravings` — the rule doesn't re-scan. `dailyDistribution`
 * uses JS getDay() (0=Sun … 6=Sat) to keep the weekend-detection
 * rule readable.
 */
export interface InsightData {
  cravings: RuleSession[];
  techniqueUses: RuleTechniqueUse[];
  triggerCounts: Record<string, number>;
  hourlyDistribution: Record<number, number>; // 0…23 → count
  dailyDistribution: Record<number, number>; // 0=Sun … 6=Sat → count
  daysSinceLastCraving: number; // Infinity if never
  now: number; // ms — injected so tests are deterministic
}

export interface InsightMatch {
  templateKey: string;
  interpolation: Record<string, string | number>;
  detailKey?: string;
  actionKey?: string; // e.g. 'open_toolkit'
  actionParams?: Record<string, string>;
}

export interface InsightOutput extends InsightMatch {
  rule_id: string;
  category: InsightCategory;
  priority: number;
}

export interface InsightRule {
  id: string;
  category: InsightCategory;
  priority: number; // 1-100, higher = shown first
  minCravings: number; // gate on total sessions before running
  evaluate: (data: InsightData) => InsightMatch | null;
}

// ─────────────────────────── Rules ───────────────────────────

const ONE_DAY_MS = 24 * 60 * 60_000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

/** 1. Peak hour — hottest hour must be 2× the average hour. */
const peakHourRule: InsightRule = {
  id: 'peak_hour',
  category: 'time',
  priority: 85,
  minCravings: 10,
  evaluate: (data) => {
    const counts = data.hourlyDistribution;
    let maxHour = -1;
    let maxCount = 0;
    for (let h = 0; h < 24; h++) {
      const c = counts[h] ?? 0;
      if (c > maxCount) {
        maxCount = c;
        maxHour = h;
      }
    }
    if (maxHour < 0) return null;
    const avgPerHour = data.cravings.length / 24;
    if (maxCount < avgPerHour * 2) return null;
    return {
      templateKey: 'insights.peak_hour.template',
      interpolation: {
        hour: `${maxHour.toString().padStart(2, '0')}:00`,
        count: maxCount,
      },
      detailKey: 'insights.peak_hour.detail',
    };
  },
};

/** 2. Dominant trigger — one trigger ≥ 35% of all trigger hits. */
const dominantTriggerRule: InsightRule = {
  id: 'dominant_trigger',
  category: 'trigger',
  priority: 90,
  minCravings: 8,
  evaluate: (data) => {
    const entries = Object.entries(data.triggerCounts);
    if (entries.length === 0) return null;
    const total = entries.reduce((sum, [, c]) => sum + c, 0);
    if (total === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    const [topId, topCount] = entries[0];
    const percent = Math.round((topCount / total) * 100);
    if (percent < 35) return null;
    return {
      templateKey: 'insights.dominant_trigger.template',
      interpolation: { trigger: topId, percent },
      detailKey: 'insights.dominant_trigger.detail',
      actionKey: 'open_toolkit',
    };
  },
};

/** 3. Effective technique — ≥ 80% positive feedback across ≥5 uses. */
const effectiveTechniqueRule: InsightRule = {
  id: 'effective_technique',
  category: 'technique',
  priority: 80,
  minCravings: 5,
  evaluate: (data) => {
    const stats = new Map<string, { total: number; positive: number }>();
    for (const use of data.techniqueUses) {
      const s = stats.get(use.technique_id) ?? { total: 0, positive: 0 };
      s.total += 1;
      if (use.feedback === 'much_better' || use.feedback === 'better') {
        s.positive += 1;
      }
      stats.set(use.technique_id, s);
    }
    let best: { id: string; ratio: number; total: number } | null = null;
    for (const [id, s] of stats) {
      if (s.total < 5) continue;
      const ratio = s.positive / s.total;
      if (!best || ratio > best.ratio) best = { id, ratio, total: s.total };
    }
    if (!best || best.ratio < 0.8) return null;
    return {
      templateKey: 'insights.effective_technique.template',
      interpolation: {
        technique: best.id,
        percent: Math.round(best.ratio * 100),
      },
      detailKey: 'insights.effective_technique.detail',
      actionKey: 'open_toolkit',
    };
  },
};

/** 4. Weekend concentration — weekends ≥1.5× weekday average. */
const weekendConcentrationRule: InsightRule = {
  id: 'weekend_concentration',
  category: 'time',
  priority: 70,
  minCravings: 14,
  evaluate: (data) => {
    const d = data.dailyDistribution;
    const weekend = (d[0] ?? 0) + (d[6] ?? 0); // Sun + Sat
    const weekday =
      (d[1] ?? 0) + (d[2] ?? 0) + (d[3] ?? 0) + (d[4] ?? 0) + (d[5] ?? 0);
    const weekendAvg = weekend / 2;
    const weekdayAvg = weekday / 5;
    if (weekdayAvg === 0) return null;
    const ratio = weekendAvg / weekdayAvg;
    if (ratio < 1.5) return null;
    return {
      templateKey: 'insights.weekend_concentration.template',
      interpolation: { multiplier: ratio.toFixed(1) },
      detailKey: 'insights.weekend_concentration.detail',
    };
  },
};

/** 5. Rising resistance — last 7d success rate up ≥15pp vs prior 7d. */
const risingResistanceRule: InsightRule = {
  id: 'rising_resistance',
  category: 'trend',
  priority: 75,
  minCravings: 14,
  evaluate: (data) => {
    const recentCut = data.now - ONE_WEEK_MS;
    const priorCut = data.now - 2 * ONE_WEEK_MS;
    const recent: RuleSession[] = [];
    const prior: RuleSession[] = [];
    for (const c of data.cravings) {
      // Only 'resolved' sessions carry an outcome — skip nulls.
      if (c.outcome !== 'resisted' && c.outcome !== 'failed') continue;
      const t = new Date(c.started_at).getTime();
      if (t > recentCut) recent.push(c);
      else if (t > priorCut) prior.push(c);
    }
    if (recent.length < 5 || prior.length < 5) return null;
    const recentSuccess =
      recent.filter((c) => c.outcome === 'resisted').length / recent.length;
    const priorSuccess =
      prior.filter((c) => c.outcome === 'resisted').length / prior.length;
    const delta = recentSuccess - priorSuccess;
    if (delta < 0.15) return null;
    return {
      templateKey: 'insights.rising_resistance.template',
      interpolation: { percent: Math.round(delta * 100) },
      detailKey: 'insights.rising_resistance.detail',
    };
  },
};

/** 6. Silence check — 2-7 days since last craving after real history. */
const silenceCheckRule: InsightRule = {
  id: 'silence_check',
  category: 'trend',
  priority: 60,
  minCravings: 5,
  evaluate: (data) => {
    const d = data.daysSinceLastCraving;
    if (!Number.isFinite(d)) return null;
    if (d < 2 || d > 7) return null;
    return {
      templateKey: 'insights.silence_check.template',
      interpolation: { days: Math.floor(d) },
      detailKey: 'insights.silence_check.detail',
    };
  },
};

export const INSIGHT_RULES: readonly InsightRule[] = [
  peakHourRule,
  dominantTriggerRule,
  effectiveTechniqueRule,
  weekendConcentrationRule,
  risingResistanceRule,
  silenceCheckRule,
];

/** Max cards the client renders. Tuning knob. */
export const MAX_INSIGHTS = 3;

/**
 * Run every rule, drop the ones that don't fire or lack data,
 * return the top MAX_INSIGHTS by priority. Deterministic ties.
 */
export function evaluateInsights(data: InsightData): InsightOutput[] {
  const matches: InsightOutput[] = [];
  const totalCravings = data.cravings.length;
  for (const rule of INSIGHT_RULES) {
    if (totalCravings < rule.minCravings) continue;
    const m = rule.evaluate(data);
    if (!m) continue;
    matches.push({
      rule_id: rule.id,
      category: rule.category,
      priority: rule.priority,
      ...m,
    });
  }
  matches.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    // Deterministic tiebreak: rule.id lexicographic.
    return a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0;
  });
  return matches.slice(0, MAX_INSIGHTS);
}
