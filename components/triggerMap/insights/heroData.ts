import type { TriggerMapInsight } from '@/lib/triggerMap';
import { t } from '@/lib/i18n';
import {
  ADDICTION_TRIGGERS,
  COMMON_TRIGGERS,
  triggerLabel,
} from '@/constants/triggerCatalog';
import { TOOLKIT_TECHNIQUES } from '@/constants/toolkitCatalog';

/**
 * Insight-card presentation adapter.
 *
 * The rule engine (`shared/insightRules.ts`) is pure and doesn't
 * know anything about our card layouts. The card design brief,
 * however, wants: a big "value" numeric, a "ring %" (0–100) for
 * the radial ring, a category label, a rule sublabel, and a body
 * description with the interpolated data folded in.
 *
 * This module maps each `rule_id` → those visual fields WITHOUT
 * changing the rule engine. If a new rule ships without an entry
 * here, the fallback still produces something sensible (message +
 * ring at 50% + no big value).
 */

export type InsightPresentation = {
  categoryLabel: string;
  sublabel: string;
  bigValue: string | null;
  /** 0-100. Drives the hero radial ring stroke-dashoffset. */
  ringPct: number;
  description: string;
  /** Which mini-viz kind to render inline on category cards. */
  viz: 'minibar' | 'sparkline' | 'none';
  /** Optional trend chip copy shown top-right on category cards. */
  trend: { label: string; direction: 'up' | 'flat' } | null;
};

/**
 * Turn raw interpolation into human labels once, so the hero and
 * category cards can share the same resolved values.
 */
function resolveInterpolation(
  insight: TriggerMapInsight,
  addictionId: string
): Record<string, string | number> {
  const src = insight.interpolation ?? {};
  const out: Record<string, string | number> = { ...src };
  if (typeof src.trigger === 'string') {
    out.trigger = resolveTriggerLabel(src.trigger, addictionId);
  }
  if (typeof src.technique === 'string') {
    const tech = TOOLKIT_TECHNIQUES.find((row) => row.id === src.technique);
    out.technique = tech
      ? t(`toolkit.techniques.${tech.id}.name`)
      : String(src.technique);
  }
  return out;
}

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

/**
 * Build the full presentation payload for a single insight card.
 * Called by the hero (first insight only) and by each category
 * card so trend/viz/label logic lives in one place.
 */
export function buildInsightPresentation(
  insight: TriggerMapInsight,
  addictionId: string
): InsightPresentation {
  const resolved = resolveInterpolation(insight, addictionId);
  const categoryLabel = t(`insights.category_label.${insight.category}`);
  const sublabel = t(`insights.sublabel.${insight.rule_id}`);

  // Per-rule big value + ring % + description.
  switch (insight.rule_id) {
    case 'peak_hour': {
      const hour = String(resolved.hour ?? '');
      const count = Number(resolved.count ?? 0);
      // Ring % = how concentrated this hour is (count vs a 24-way
      // even spread ceiling of ~2x). Cap at 100.
      const ringPct = clampPct(count > 0 ? Math.min(100, count * 12) : 0);
      return {
        categoryLabel,
        sublabel,
        bigValue: t('insights.hero.value_hour', { hour }),
        ringPct,
        description: t('insights.hero.description_peak_hour'),
        viz: 'minibar',
        trend: null,
      };
    }
    case 'dominant_trigger': {
      const percent = Number(resolved.percent ?? 0);
      const trigger = String(resolved.trigger ?? '');
      return {
        categoryLabel,
        sublabel,
        bigValue: t('insights.hero.value_percent', { percent }),
        ringPct: clampPct(percent),
        description: t('insights.hero.description_dominant_trigger', {
          trigger,
        }),
        viz: 'minibar',
        trend: { label: `${percent}%`, direction: 'up' },
      };
    }
    case 'effective_technique': {
      const percent = Number(resolved.percent ?? 0);
      const technique = String(resolved.technique ?? '');
      return {
        categoryLabel,
        sublabel,
        bigValue: t('insights.hero.value_percent', { percent }),
        ringPct: clampPct(percent),
        description: t('insights.hero.description_effective_technique', {
          technique,
        }),
        viz: 'sparkline',
        trend: { label: `${percent}%`, direction: 'up' },
      };
    }
    case 'rising_resistance': {
      const percent = Number(resolved.percent ?? 0);
      return {
        categoryLabel,
        sublabel,
        bigValue: `+${percent}%`,
        ringPct: clampPct(percent * 2),
        description: t('insights.hero.description_rising_resistance'),
        viz: 'sparkline',
        trend: { label: `+${percent}%`, direction: 'up' },
      };
    }
    case 'weekend_concentration': {
      const raw = String(resolved.multiplier ?? '1.0');
      const mult = Number.parseFloat(raw) || 1;
      return {
        categoryLabel,
        sublabel,
        bigValue: t('insights.hero.value_multiplier', {
          multiplier: raw,
        }),
        // 1× = 0%, 3× = ~100%
        ringPct: clampPct((mult - 1) * 50),
        description: t('insights.hero.description_weekend_concentration'),
        viz: 'minibar',
        trend: { label: `${raw}×`, direction: 'up' },
      };
    }
    case 'silence_check': {
      const days = Number(resolved.days ?? 0);
      return {
        categoryLabel,
        sublabel,
        bigValue: t('insights.hero.value_days', { days }),
        ringPct: clampPct((days / 7) * 100),
        description: t('insights.hero.description_silence_check'),
        viz: 'none',
        trend: null,
      };
    }
    default: {
      // Unknown rule → render whatever the template gives us.
      return {
        categoryLabel,
        sublabel,
        bigValue: null,
        ringPct: 50,
        description: t(insight.templateKey, resolved),
        viz: 'none',
        trend: null,
      };
    }
  }
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}
