import type { ComparisonStatsResult } from '@/shared/comparisonStats';
import { t } from '@/lib/i18n';
import {
  COMMON_TRIGGERS,
  ADDICTION_TRIGGERS,
  triggerLabel,
} from '@/constants/triggerCatalog';
import { getTechnique, techniqueName } from '@/constants/toolkitCatalog';
import type {
  ComparisonData,
  DistributionMetric,
  PulseData,
  PatternsData,
} from './__mockData';

/**
 * Server → render mapper for the Comparison sub-tab.
 *
 * `comparison-data` emits ids + numbers only (locale-independent). The
 * client owns display: trigger/technique ids → labels, numbers →
 * formatted deltas and avg strings, and the honest ticker copy built
 * from real aggregates (never fabricated "2 min ago" events). This is
 * the single place that turns a `ComparisonStatsResult` into the
 * `ComparisonData` the cards consume.
 *
 * `state` here is the backend's honesty signal (full / launch /
 * lowdata). The Free-tier overlay is a separate, client-only concern
 * applied by the pane from `useIsPremium()` — it is NOT decided here.
 */

/** Same policy as the Triggers pane: common set first, then the
 *  addiction-specific set, then the raw id. Keeps labels agreeing
 *  across modules. */
function resolveTriggerLabel(id: string, addictionId: string): string {
  if (COMMON_TRIGGERS.some((row) => row.id === id)) {
    return triggerLabel({ id, scope: 'common', displayOrder: 0 });
  }
  const list = ADDICTION_TRIGGERS[addictionId] ?? [];
  if (list.some((row) => row.id === id)) {
    return triggerLabel({ id, scope: addictionId, displayOrder: 0 });
  }
  return id;
}

function resolveTechniqueLabel(id: string): string {
  const tech = getTechnique(id);
  return tech ? techniqueName(tech) : id;
}

/** Weekday initials, Mon..Sun — matches the bar's Mon-based indexing. */
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function mapPulse(r: ComparisonStatsResult, addictionId: string): PulseData {
  const top = r.pulse.topTrigger;
  const topTrigger = top
    ? {
        label: resolveTriggerLabel(top.triggerId, addictionId),
        percent: top.percent,
      }
    : { label: t('comparison.pulse_no_trigger'), percent: 0 };

  // Ticker is built ONLY from real aggregates — no fake live events.
  // Lines with no data are dropped so we never assert an empty number.
  const ticker: string[] = [];
  if (r.pulse.cravingsResisted > 0) {
    ticker.push(
      t('comparison.ticker_resisted', { count: r.pulse.cravingsResisted })
    );
  }
  if (r.pulse.peopleThisWeek > 0) {
    ticker.push(
      t('comparison.ticker_people', { count: r.pulse.peopleThisWeek })
    );
  }
  if (top) {
    ticker.push(t('comparison.ticker_trigger', { trigger: topTrigger.label }));
  }

  return {
    peopleThisWeek: r.pulse.peopleThisWeek,
    cravingsResisted: r.pulse.cravingsResisted,
    topTrigger,
    ticker,
  };
}

/** `+N`/`N`/`0` with a unit suffix, sign preserved. */
function signed(delta: number, unit: string): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}${unit}`;
}

function mapDistribution(r: ComparisonStatsResult): DistributionMetric[] {
  const byKey = new Map(r.distribution.map((d) => [d.key, d]));

  const out: DistributionMetric[] = [];

  const rate = byKey.get('resistance_rate');
  if (rate) {
    out.push({
      key: 'resistance_rate',
      labelKey: 'comparison.metric.resistance_rate',
      icon: 'shield-check',
      youNum: rate.youNum,
      suffix: '%',
      avg: rate.avg,
      avgLabel: `${rate.avg}%`,
      // Curve math in DistributionCard divides by sd; a degenerate
      // zero-variance cohort would blow up to ±Infinity, so floor it.
      sd: Math.max(1, rate.sd),
      tone: rate.tone,
      deltaLabel: `${signed(rate.delta, '')} pts`,
    });
  }

  const hold = byKey.get('hold_out');
  if (hold) {
    out.push({
      key: 'hold_out',
      labelKey: 'comparison.metric.hold_out',
      icon: 'timer',
      youNum: hold.youNum,
      unit: 'min',
      avg: hold.avg,
      avgLabel: `${hold.avg} min`,
      sd: Math.max(1, hold.sd),
      tone: hold.tone,
      deltaLabel: `${signed(hold.delta, '')} min`,
    });
  }

  const crav = byKey.get('cravings_week');
  if (crav) {
    // Fewer cravings reads as "N fewer"; more as "N more". Never a
    // percentile claim (tone stays neutral per the design brief).
    const d = crav.delta;
    const deltaLabel =
      d < 0
        ? t('comparison.delta_fewer', { count: -d })
        : d > 0
          ? t('comparison.delta_more', { count: d })
          : t('comparison.delta_same');
    out.push({
      key: 'cravings_week',
      labelKey: 'comparison.metric.cravings_week',
      icon: 'activity',
      youNum: crav.youNum,
      avg: crav.avg,
      avgLabel: `${crav.avg}`,
      sd: Math.max(1, crav.sd),
      tone: 'neutral',
      deltaLabel,
      note: 'comparison.cravings_note',
    });
  }

  return out;
}

function mapPatterns(
  r: ComparisonStatsResult,
  addictionId: string
): PatternsData {
  void addictionId;
  const wave = r.patterns.wave
    ? {
        techniqueLabel: resolveTechniqueLabel(r.patterns.wave.techniqueId),
        successPct: r.patterns.wave.successPct,
      }
    : { techniqueLabel: t('comparison.pulse_no_trigger'), successPct: 0 };

  return {
    clock: r.patterns.clock,
    wave,
    bar: {
      values: r.patterns.bar.values,
      hardestDayIdx: r.patterns.bar.hardestDayIdx,
      labels: DAY_LABELS,
    },
  };
}

export function toComparisonData(
  r: ComparisonStatsResult,
  addictionId: string
): ComparisonData {
  return {
    state: r.state,
    pulse: mapPulse(r, addictionId),
    distribution: mapDistribution(r),
    standing: r.standing,
    patterns: mapPatterns(r, addictionId),
  };
}
