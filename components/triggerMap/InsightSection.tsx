import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '@/lib/i18n';
import type { TriggerMapInsight } from '@/lib/triggerMap';
import { InsightsHero } from './insights/InsightsHero';
import { CategoryInsightCard } from './insights/CategoryInsightCard';

/**
 * Personal Insights section — Modül 3 redesign entry point.
 *
 * The top-priority insight promotes to a `InsightsHero` card
 * (big value + radial % ring). Remaining insights render as
 * `CategoryInsightCard` — colour-coded by category, with a
 * trend chip + inline mini viz.
 *
 * Empty state stays a dimmed one-liner (design brief) — the
 * section shouldn't shout when there's nothing to say. Insights
 * always fall back to the sensible tier when the hero data
 * adapter can't derive a big value (see heroData.ts).
 *
 * Accordion: one card open at a time. State lives here so the
 * cards themselves stay stateless.
 *
 * NOTE (redesign): `accentColor` prop kept in signature for
 * backwards compatibility with the existing call-site, but no
 * longer forwarded — the Triggers module owns its own accent
 * (see triggersTheme) so category cards can carry their own
 * hue without a parent override.
 */

type Props = {
  insights: TriggerMapInsight[];
  addictionId: string;
  /** Deprecated in redesign — kept to avoid a call-site churn. */
  accentColor?: string;
  onAction?: (actionKey: string, params?: Record<string, string>) => void;
};

export function InsightSection({
  insights,
  addictionId,
  accentColor,
  onAction,
}: Props) {
  void accentColor;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (insights.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{t('insights.section_title')}</Text>
        <Text style={styles.empty}>{t('insights.empty_message')}</Text>
      </View>
    );
  }

  const [hero, ...rest] = insights;
  const toggle = (ruleId: string) =>
    setExpandedId((prev) => (prev === ruleId ? null : ruleId));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('insights.section_title')}</Text>
      <InsightsHero
        insight={hero}
        addictionId={addictionId}
        expanded={expandedId === hero.rule_id}
        onToggle={() => toggle(hero.rule_id)}
      />
      {rest.map((ins) => (
        <CategoryInsightCard
          key={ins.rule_id}
          insight={ins}
          addictionId={addictionId}
          expanded={expandedId === ins.rule_id}
          onToggle={() => toggle(ins.rule_id)}
          onAction={onAction}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 22,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  empty: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },
});
