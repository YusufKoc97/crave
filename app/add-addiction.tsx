import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAddictions } from '@/context/AddictionsContext';
import { maxMinutesFor } from '@/constants/addictions';

const COLOR_OPTIONS = [
  '#10B981', '#22D3EE', '#3B82F6', '#A78BFA',
  '#EC4899', '#F472B6', '#EF4444', '#FB923C',
  '#FBBF24', '#A3E635', '#94A3B8', '#E879F9',
];

const EMOJI_OPTIONS = [
  '🚬', '🍷', '🍺', '🥃', '🍾', '🍔',
  '🍟', '🍕', '🍩', '🍫', '☕', '📱',
  '💊', '💳', '🎰', '🎴', '🃏', '🎲',
  '🙈', '👁️', '⚡', '🔥', '💸', '🛍️',
  '🍯', '🍦', '🥤', '🎮', '📺', '🎬',
];

const SENSITIVITY_LABELS: Record<number, string> = {
  1: 'Very mild',
  2: 'Mild',
  3: 'Light',
  4: 'Light-Moderate',
  5: 'Moderate',
  6: 'Moderate-High',
  7: 'High',
  8: 'Strong',
  9: 'Severe',
  10: 'Extreme',
};

export default function AddAddictionScreen() {
  const { addAddiction } = useAddictions();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [sensitivity, setSensitivity] = useState(5);

  const canSubmit = name.trim().length > 0;
  const ceilingMinutes = maxMinutesFor(sensitivity);

  const submit = () => {
    if (!canSubmit) return;
    addAddiction({ name: name.trim(), emoji, color, sensitivity });
    router.back();
  };

  return (
    <View style={styles.root}>
      {/* Header — close + a tiny live preview chip on the right */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.iconBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Craving</Text>
        <View style={styles.previewChip}>
          <View
            style={[
              styles.previewChipDot,
              { backgroundColor: hexToRgba(color, 0.9) },
            ]}
          />
          <Text style={styles.previewChipText}>{emoji}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name input — primary field */}
        <Section label="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Late-night scrolling"
            placeholderTextColor="#3D5470"
            style={[styles.nameInput, { borderColor: name ? hexToRgba(color, 0.4) : '#1A2A45' }]}
            maxLength={28}
            returnKeyType="done"
          />
        </Section>

        {/* Sensitivity 1-10 */}
        <Section
          label="Sensitivity"
          hint={`${sensitivity} · ${SENSITIVITY_LABELS[sensitivity]} · ${ceilingMinutes}min`}
        >
          <View style={styles.sensitivityRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const active = n <= sensitivity;
              const isSelected = n === sensitivity;
              return (
                <Pressable
                  key={n}
                  onPress={() => setSensitivity(n)}
                  style={[
                    styles.sensCell,
                    {
                      backgroundColor: active ? color : '#0A1628',
                      borderColor: isSelected ? '#F1F5F9' : active ? color : '#1A2A45',
                      opacity: active ? 0.5 + (n / 10) * 0.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sensNum,
                      { color: active ? '#F1F5F9' : '#3D5470' },
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Color — single-row horizontal scroll */}
        <Section label="Color">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollRow}
          >
            {COLOR_OPTIONS.map((c) => {
              const selected = c === color;
              return (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: c,
                      borderColor: selected ? '#F1F5F9' : 'rgba(255,255,255,0.04)',
                      borderWidth: selected ? 2 : 1,
                      transform: selected ? [{ scale: 1.08 }] : undefined,
                    },
                  ]}
                />
              );
            })}
          </ScrollView>
        </Section>

        {/* Icon — single-row horizontal scroll */}
        <Section label="Icon">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollRow}
          >
            {EMOJI_OPTIONS.map((e) => {
              const selected = e === emoji;
              return (
                <Pressable
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[
                    styles.emojiCell,
                    {
                      backgroundColor: selected ? hexToRgba(color, 0.18) : '#0A1628',
                      borderColor: selected ? hexToRgba(color, 0.7) : '#1A2A45',
                    },
                  ]}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>

        <View style={{ height: 12 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[
            styles.submitBtn,
            {
              borderColor: canSubmit ? color : '#1A2A45',
              backgroundColor: canSubmit ? hexToRgba(color, 0.12) : '#080F1C',
              opacity: canSubmit ? 1 : 0.55,
            },
          ]}
        >
          <Text
            style={[
              styles.submitText,
              { color: canSubmit ? color : '#3D5470' },
            ]}
          >
            Add Craving
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
        {hint && <Text style={styles.sectionHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    color: '#7BA8C8',
    fontSize: 14,
    lineHeight: 16,
  },
  headerTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  previewChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewChipDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewChipText: {
    fontSize: 17,
    lineHeight: 19,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 18,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sectionHint: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '500',
  },
  nameInput: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '400',
  },
  sensitivityRow: {
    flexDirection: 'row',
    gap: 4,
  },
  sensCell: {
    flex: 1,
    height: 30,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensNum: {
    fontSize: 11,
    fontWeight: '600',
  },
  scrollRow: {
    gap: 8,
    paddingRight: 18,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  emojiCell: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 20,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 18,
    paddingBottom: 22,
    paddingTop: 8,
  },
  submitBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
});
