import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '@/lib/i18n';
import type { TriggerMapInsight } from '@/lib/triggerMap';
import { InsightCard } from './InsightCard';

/**
 * Faz 8b — Personal Insights section at the top of the Triggers
 * sub-tab (above the heatmap).
 *
 * Empty state (no rule fired) is a dimmed one-liner, not a card
 * — the section shouldn't shout when there's nothing to say.
 *
 * Accordion: one card open at a time. State lives here so the
 * cards themselves stay stateless.
 */

type Props = {
  insights: TriggerMapInsight[];
  addictionId: string;
  accentColor: string;
  onAction?: (actionKey: string, params?: Record<string, string>) => void;
};

export function InsightSection({
  insights,
  addictionId,
  accentColor,
  onAction,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('insights.section_title')}</Text>
      {insights.length === 0 ? (
        <Text style={styles.empty}>{t('insights.empty_message')}</Text>
      ) : (
        insights.map((ins) => (
          <InsightCard
            key={ins.rule_id}
            insight={ins}
            addictionId={addictionId}
            accentColor={accentColor}
            expanded={expandedId === ins.rule_id}
            onToggle={() =>
              setExpandedId((prev) =>
                prev === ins.rule_id ? null : ins.rule_id
              )
            }
            onAction={onAction}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
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
