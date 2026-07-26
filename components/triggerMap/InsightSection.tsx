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
 * The module accent reaches the cards through
 * `TriggersAccentProvider` (mounted by `TriggersPane`), not through
 * props — the tree is too deep for drilling and most accent values
 * live in style blocks. `index` IS drilled, because the entrance
 * stagger has to know each card's position in this stack.
 */

type Props = {
  insights: TriggerMapInsight[];
  addictionId: string;
  onAction?: (actionKey: string, params?: Record<string, string>) => void;
};

export function InsightSection({ insights, addictionId, onAction }: Props) {
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
        index={0}
      />
      {rest.map((ins, i) => (
        <CategoryInsightCard
          key={ins.rule_id}
          insight={ins}
          addictionId={addictionId}
          expanded={expandedId === ins.rule_id}
          onToggle={() => toggle(ins.rule_id)}
          onAction={onAction}
          index={i + 1}
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
