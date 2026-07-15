import { StyleSheet, Text, View } from 'react-native';
import { triggerLabel } from '@/constants/triggerCatalog';
import type { TriggerMapTrigger } from '@/lib/triggerMap';
import { t } from '@/lib/i18n';

/**
 * Faz 8a — horizontal bar chart of trigger frequency.
 *
 * Rows sorted by count desc (server-provided). Each row:
 *   [label]  [filled bar, width ∝ percentage]  [percent + intensity]
 *
 * "Most common intensity" is a server-side mode (see Edge Function
 * comment) so the client only renders "Mostly {{level}}".
 *
 * We resolve label copy via the shared triggerCatalog helper —
 * scope defaults to 'common' if the id isn't in the addiction's
 * specific list, mirroring how the picker renders unknown ids.
 */

type Props = {
  triggers: TriggerMapTrigger[];
  accentColor: string;
  addictionId: string;
  periodLabel: string;
};

export function TriggerDistribution({
  triggers,
  accentColor,
  addictionId,
  periodLabel,
}: Props) {
  if (triggers.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>
          {t('trigger_map.distribution.title', { period: periodLabel })}
        </Text>
        <Text style={styles.emptyText}>
          {t('trigger_map.distribution.no_triggers')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        {t('trigger_map.distribution.title', { period: periodLabel })}
      </Text>
      {triggers.map((row) => {
        const label = triggerLabel({
          id: row.trigger_id,
          scope: addictionId,
          displayOrder: 0,
        });
        const barWidth = Math.max(2, Math.min(100, row.percentage));
        return (
          <View key={row.trigger_id} style={styles.row}>
            <Text style={styles.labelText} numberOfLines={1}>
              {label}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${barWidth}%`,
                    backgroundColor: accentColor,
                  },
                ]}
              />
            </View>
            <View style={styles.rightCol}>
              <Text style={[styles.percentText, { color: accentColor }]}>
                {t('trigger_map.distribution.percent', {
                  percent: row.percentage,
                })}
              </Text>
              {row.most_common_intensity ? (
                <Text style={styles.intensityText} numberOfLines={1}>
                  {t('trigger_map.distribution.mostly', {
                    level: t(
                      `trigger_map.intensity_levels.${row.most_common_intensity}`
                    ),
                  })}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    borderRadius: 14,
    padding: 16,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  emptyText: {
    color: '#6B8BA4',
    fontSize: 12.5,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  labelText: {
    color: '#F1F5F9',
    fontSize: 12.5,
    fontWeight: '500',
    width: 110,
    flexShrink: 0,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#13213A',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  rightCol: {
    width: 90,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  intensityText: {
    color: '#94A3B8',
    fontSize: 10.5,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
