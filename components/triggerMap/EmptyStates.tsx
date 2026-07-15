import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/lib/i18n';

/**
 * Faz 8a — progressive-disclosure placeholders for the
 * TriggersPane. Two variants:
 *   - Zero: user has never logged a craving for this addiction.
 *           Full-page card with the "no data yet" copy.
 *   - Sparse: 1–5 cravings recorded. Small nudge that still
 *             leaves the heatmap visible above it, but hides
 *             peak-hour + distribution sections.
 */

type Props = {
  variant: 'zero' | 'sparse';
  accentColor: string;
};

export function EmptyState({ variant, accentColor }: Props) {
  const titleKey =
    variant === 'zero'
      ? 'trigger_map.empty.zero_title'
      : 'trigger_map.empty.sparse_title';
  const bodyKey =
    variant === 'zero'
      ? 'trigger_map.empty.zero_body'
      : 'trigger_map.empty.sparse_body';
  return (
    <View style={[styles.wrap, variant === 'zero' && styles.wrapZero]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: hexAlpha(accentColor, 0.12),
            borderColor: hexAlpha(accentColor, 0.35),
          },
        ]}
      >
        <Ionicons
          name={variant === 'zero' ? 'compass-outline' : 'analytics-outline'}
          size={20}
          color={accentColor}
        />
      </View>
      <Text style={styles.title}>{t(titleKey)}</Text>
      <Text style={styles.body}>{t(bodyKey)}</Text>
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
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    alignItems: 'center',
    marginBottom: 16,
  },
  wrapZero: {
    paddingVertical: 40,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
