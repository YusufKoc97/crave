import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@/lib/i18n';

/**
 * Faz 5 — post-resist intensity rating. Fires immediately after
 * "I Resisted" is tapped, BEFORE the celebration banner / rank
 * unlock modal. Picking a value (or Skip) closes the modal and
 * hands the number (or null) back so `finish()` can pass it into
 * the resolve-craving invoke.
 *
 * 5-emoji ladder mild → unbearable (1..5). Skip returns null;
 * `resolve-craving` treats null as "no rating", stores it as such
 * on craving_sessions.intensity.
 *
 * Not dismissable via backdrop — user must either pick a rating or
 * explicitly hit Skip. Karar #5: skip is a first-class option, no
 * friction for users who want to move on.
 */

type Props = {
  visible: boolean;
  accentColor: string;
  onSelect: (intensity: number | null) => void;
};

type Option = {
  value: number;
  labelKey: string;
  emoji: string;
};

const OPTIONS: Option[] = [
  { value: 1, labelKey: 'craving_flow.intensity.mild', emoji: '😌' },
  { value: 2, labelKey: 'craving_flow.intensity.moderate', emoji: '😕' },
  { value: 3, labelKey: 'craving_flow.intensity.strong', emoji: '😖' },
  { value: 4, labelKey: 'craving_flow.intensity.very_strong', emoji: '😣' },
  { value: 5, labelKey: 'craving_flow.intensity.unbearable', emoji: '😫' },
];

export function IntensityModal({ visible, accentColor, onSelect }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onSelect(null)}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {t('craving_flow.intensity_question')}
          </Text>
          <Text style={styles.subtitle}>
            {t('craving_flow.intensity_subtitle')}
          </Text>

          <View style={styles.grid}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => onSelect(opt.value)}
                style={styles.optionBtn}
                accessibilityRole="button"
                accessibilityLabel={t(opt.labelKey)}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text
                  style={[styles.optionLabel, { color: accentColor }]}
                  numberOfLines={1}
                >
                  {t(opt.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => onSelect(null)}
            style={styles.skipBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('craving_flow.intensity_skip')}
          >
            <Text style={styles.skipText}>
              {t('craving_flow.intensity_skip')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0A1628',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    boxShadow:
      '0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  title: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  grid: {
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    // 5 emoji buttons: three in the top row, two centred underneath
    // via wrap. Chip width is fixed so the grid stays symmetric.
    gap: 8,
  },
  optionBtn: {
    width: 100,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    backgroundColor: '#080F1C',
    alignItems: 'center',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  optionEmoji: {
    fontSize: 30,
    lineHeight: 34,
  },
  optionLabel: {
    marginTop: 6,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  skipBtn: {
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  skipText: {
    color: '#7BA8C8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
});
