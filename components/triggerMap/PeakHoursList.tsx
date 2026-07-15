import { StyleSheet, Text, View } from 'react-native';
import { DAY_KEYS } from '@/constants/heatmap';
import type { TriggerMapPeak } from '@/lib/triggerMap';
import { t } from '@/lib/i18n';

/**
 * Faz 8a — top-3 peak-hour rows derived from the heatmap.
 * Server-side sorted; client just renders in order.
 *
 * Row copy: "{{day}} {{start}}:00–{{end}}:00" + count.
 * End-hour rolls to the next hour so "19:00" reads as
 * "19:00–20:00" for a 1-hour window (the smallest unit the
 * heatmap represents).
 */

type Props = {
  peaks: TriggerMapPeak[];
  accentColor: string;
};

function formatHour(h: number): string {
  return String(h).padStart(2, '0');
}

export function PeakHoursList({ peaks, accentColor }: Props) {
  if (peaks.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.subtitle}>
        {t('trigger_map.peak_hours.subtitle')}
      </Text>
      {peaks.map((peak, idx) => {
        const dayKey = DAY_KEYS[peak.day] ?? 'mon';
        const dayLabel = t(`trigger_map.heatmap.days_long.${dayKey}`);
        const rangeLabel = t('trigger_map.peak_hours.row_range', {
          day: dayLabel,
          startHour: formatHour(peak.hour),
          endHour: formatHour((peak.hour + 1) % 24),
        });
        return (
          <View
            key={`${peak.day}-${peak.hour}`}
            style={[styles.row, idx === peaks.length - 1 && styles.rowLast]}
          >
            <View style={styles.rowLeft}>
              <View
                style={[
                  styles.rank,
                  {
                    borderColor: accentColor,
                    backgroundColor: hexAlpha(accentColor, 0.14),
                  },
                ]}
              >
                <Text style={[styles.rankText, { color: accentColor }]}>
                  {idx + 1}
                </Text>
              </View>
              <Text style={styles.rangeText} numberOfLines={1}>
                {rangeLabel}
              </Text>
            </View>
            <Text style={styles.countText}>
              {t('trigger_map.peak_hours.row_count', { count: peak.count })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  subtitle: {
    color: '#6B8BA4',
    fontSize: 11,
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#13213A',
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  rank: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  rangeText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  countText: {
    color: '#94A3B8',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
