import { StyleSheet, Text, View } from 'react-native';

/**
 * Two-segment progress indicator used at the top of every onboarding
 * screen. Replaces the older "ADIM 1 / 2" text label so the user gets
 * a visual sense of how much further they have to go without having to
 * read a count.
 *
 * Lives in components/ so onboarding/index.tsx and onboarding/consent.tsx
 * can share it without copy-pasting the bar styling.
 */
export function StepIndicator({
  step,
  total,
  accent = '#3B82F6',
}: {
  step: number;
  total: number;
  accent?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, i) => {
          const active = i < step;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  backgroundColor: active ? accent : '#1A2A45',
                  opacity: active ? 1 : 0.7,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.label}>
        ADIM {step} <Text style={styles.labelDim}>/ {total}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  bars: {
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  label: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
  },
  labelDim: {
    color: '#3D5470',
    fontWeight: '500',
  },
});
