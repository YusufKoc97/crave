import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PERIOD_ORDER, type PeriodKey } from '@/constants/heatmap';
import { Crown } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { PREMIUM_GOLD } from '@/components/ui/PremiumButton';

/**
 * Faz 8a — segmented time-period picker. Renders three pills
 * (Last 7 days / Last 30 days / All time). Selection change
 * triggers a fresh React Query fetch via the parent's `onChange`.
 */

/** Periods Free can pick; the rest carry a crown and open the paywall. */
export const FREE_PERIODS: readonly PeriodKey[] = ['7d'];

type Props = {
  value: PeriodKey;
  onChange: (period: PeriodKey) => void;
  accentColor: string;
  isPremium: boolean;
  onLockedPress: () => void;
};

export function PeriodFilter({
  value,
  onChange,
  accentColor,
  isPremium,
  onLockedPress,
}: Props) {
  return (
    <View style={styles.row}>
      {PERIOD_ORDER.map((period) => {
        const active = period === value;
        const locked = !isPremium && !FREE_PERIODS.includes(period);
        return (
          <Pressable
            key={period}
            onPress={() => (locked ? onLockedPress() : onChange(period))}
            style={[
              styles.pill,
              active
                ? {
                    borderColor: accentColor,
                    backgroundColor: hexAlpha(accentColor, 0.14),
                  }
                : styles.pillIdle,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(`trigger_map.period.${period}`)}
          >
            <Text
              style={[
                styles.label,
                active ? { color: accentColor } : styles.labelIdle,
              ]}
            >
              {t(`trigger_map.period.${period}`)}
            </Text>
            {locked ? (
              <Crown
                size={12}
                color={PREMIUM_GOLD}
                strokeWidth={2.2}
                style={styles.crown}
              />
            ) : null}
          </Pressable>
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
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillIdle: {
    borderColor: '#1E2D4D',
    backgroundColor: '#0A1628',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  crown: {
    marginLeft: 6,
  },
  labelIdle: {
    color: '#94A3B8',
  },
});
