import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAddictions } from '@/context/AddictionsContext';
import { maxMinutesFor } from '@/constants/addictions';

// 24-color curated palette ordered by hue (green → cyan → blue → purple →
// pink → red → orange → yellow → neutral). Each value is hand-picked to
// stay readable on the #020810 dark background.
const COLOR_OPTIONS = [
  '#10B981', '#34D399', '#A3E635', '#14B8A6',
  '#06B6D4', '#22D3EE', '#0EA5E9', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A78BFA', '#C084FC',
  '#E879F9', '#EC4899', '#F472B6', '#F43F5E',
  '#EF4444', '#F97316', '#FB923C', '#FBBF24',
  '#FACC15', '#D6D3D1', '#94A3B8', '#6B7280',
];

// Curated emoji palette grouped into addiction-relevant categories.
// Total ~150 — wide enough for personal expression, narrow enough to avoid
// decision paralysis on a recovery app.
const EMOJI_CATEGORIES: { id: string; label: string; tab: string; emojis: string[] }[] = [
  {
    id: 'substances',
    label: 'Bağımlılıklar',
    tab: '🚬',
    emojis: [
      '🚬', '🚭', '💨', '🌿', '🍃',
      '🍺', '🍻', '🍷', '🥂', '🍾', '🍸', '🍹', '🍶', '🥃', '🧉',
      '☕', '🍵', '🥤', '🧋', '🧃',
      '💊', '💉', '🧪', '⚗️', '🩸',
    ],
  },
  {
    id: 'food',
    label: 'Yiyecek',
    tab: '🍔',
    emojis: [
      '🍔', '🍟', '🌭', '🍕', '🌮', '🌯', '🥙', '🥪', '🥨', '🍿',
      '🍩', '🍪', '🧁', '🍰', '🎂', '🥧', '🍫', '🍬', '🍭', '🍮',
      '🍦', '🍨', '🍯', '🥞', '🧇',
    ],
  },
  {
    id: 'activities',
    label: 'Aktivite',
    tab: '🎮',
    emojis: [
      '📱', '💻', '🖥️', '⌨️', '🖱️',
      '🎮', '🕹️', '🎲', '🎰', '🎴', '🃏', '♠️', '♥️', '♦️', '♣️',
      '📺', '🎬', '🍿', '📷', '🎵', '🎧',
      '🛍️', '💸', '💳', '💰',
    ],
  },
  {
    id: 'faces',
    label: 'Yüzler',
    tab: '🙈',
    emojis: [
      '🙈', '🙉', '🙊', '😶', '😔', '😞', '😟', '😣', '😖',
      '😩', '😫', '😤', '😡', '😠', '🤬',
      '😢', '😭', '😪', '😴', '🥱',
      '🥺', '😬', '🫠', '🫣', '🫨',
      '🤤', '😋', '🥹', '👁️', '🫥',
    ],
  },
  {
    id: 'symbols',
    label: 'Sembol',
    tab: '⚡',
    emojis: [
      '⚡', '🔥', '💥', '💢', '💫', '✨', '💯',
      '❤️', '🖤', '💔', '🩷', '❤️‍🩹',
      '⏰', '⏳', '🕯️', '🧠', '👁️‍🗨️',
      '🔞', '⚠️', '🚫', '⛔', '🆘',
    ],
  },
  {
    id: 'objects',
    label: 'Nesne',
    tab: '🎁',
    emojis: [
      '🎁', '🎀', '🛒', '👛', '💼', '🔑', '🗝️',
      '📦', '🧴', '🧻', '🪞', '🛏️', '🚿',
      '🪙', '💎', '⌚', '📿', '👠', '👗',
      '💄', '💋', '💅', '🎯', '🎪',
    ],
  },
];

const DEFAULT_EMOJI = '🚬';

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

const NAME_MAX = 28;

export default function AddAddictionScreen() {
  const { addictions, addAddiction, updateAddiction } = useAddictions();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = useMemo(() => {
    if (!params.id) return null;
    return addictions.find((a) => a.id === params.id) ?? null;
  }, [params.id, addictions]);
  const isEditMode = !!editing;

  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState(editing?.emoji ?? DEFAULT_EMOJI);
  const [color, setColor] = useState(editing?.color ?? COLOR_OPTIONS[0]);
  const [sensitivity, setSensitivity] = useState(editing?.sensitivity ?? 5);
  const [colorOpen, setColorOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !submitting;
  const ceilingMinutes = maxMinutesFor(sensitivity);
  const nameLen = name.length;
  const nameNearLimit = nameLen >= NAME_MAX - 5;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEditMode && editing) {
        await updateAddiction(editing.id, {
          name: name.trim(),
          emoji,
          color,
          sensitivity,
        });
      } else {
        await addAddiction({ name: name.trim(), emoji, color, sensitivity });
      }
      router.back();
    } catch (e) {
      setSubmitError(
        (e as Error).message ?? 'Bir şey ters gitti. Tekrar dene.'
      );
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header — close + a tiny live preview chip on the right */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.iconBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Craving' : 'New Craving'}
        </Text>
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
        <Section
          label="Name"
          hint={`${nameLen}/${NAME_MAX}`}
          hintColor={nameNearLimit ? color : undefined}
        >
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Late-night scrolling"
            placeholderTextColor="#3D5470"
            style={[styles.nameInput, { borderColor: name ? hexToRgba(color, 0.4) : '#1A2A45' }]}
            maxLength={NAME_MAX}
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

        {/* Style — color (inline grid) + icon (modal picker) */}
        <Section label="Style">
          <View style={styles.styleRow}>
            <Pressable
              onPress={() => setColorOpen((v) => !v)}
              style={[
                styles.styleBtn,
                {
                  borderColor: colorOpen ? hexToRgba(color, 0.7) : '#1A2A45',
                  backgroundColor: colorOpen ? hexToRgba(color, 0.08) : '#0A1628',
                },
              ]}
            >
              <View style={[styles.styleBtnSwatch, { backgroundColor: color }]} />
              <Text style={styles.styleBtnLabel}>Color</Text>
              <Text style={styles.styleBtnChevron}>{colorOpen ? '▴' : '▾'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setIconOpen((v) => !v);
                setColorOpen(false);
              }}
              style={[
                styles.styleBtn,
                {
                  borderColor: iconOpen ? hexToRgba(color, 0.7) : '#1A2A45',
                  backgroundColor: iconOpen ? hexToRgba(color, 0.08) : '#0A1628',
                },
              ]}
            >
              <Text style={styles.styleBtnEmoji}>{emoji}</Text>
              <Text style={styles.styleBtnLabel}>Icon</Text>
              <Text style={styles.styleBtnChevron}>{iconOpen ? '▴' : '▾'}</Text>
            </Pressable>
          </View>

          {colorOpen && (
            <View style={styles.pickerGrid}>
              {COLOR_OPTIONS.map((c) => {
                const selected = c === color;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setColor(c);
                      setColorOpen(false);
                    }}
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
            </View>
          )}

          {iconOpen && (
            <EmojiPicker
              emoji={emoji}
              accent={color}
              onPick={(e) => {
                setEmoji(e);
                setIconOpen(false);
              }}
            />
          )}
        </Section>

        <View style={{ height: 12 }} />
      </ScrollView>

      <View style={styles.footer}>
        {submitError && (
          <Text style={styles.submitError}>{submitError}</Text>
        )}
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
            {submitting
              ? isEditMode
                ? 'Saving...'
                : 'Adding...'
              : isEditMode
                ? 'Save Changes'
                : 'Add Craving'}
          </Text>
        </Pressable>
      </View>

    </View>
  );
}

function EmojiPicker({
  emoji,
  accent,
  onPick,
}: {
  emoji: string;
  accent: string;
  onPick: (e: string) => void;
}) {
  const [activeCat, setActiveCat] = useState(EMOJI_CATEGORIES[0].id);
  const cat = EMOJI_CATEGORIES.find((c) => c.id === activeCat) ?? EMOJI_CATEGORIES[0];

  return (
    <View style={styles.emojiPicker}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.emojiTabsRow}
      >
        {EMOJI_CATEGORIES.map((c) => {
          const active = c.id === activeCat;
          return (
            <Pressable
              key={c.id}
              onPress={() => setActiveCat(c.id)}
              style={[
                styles.emojiTab,
                {
                  backgroundColor: active ? hexToRgba(accent, 0.18) : '#0A1628',
                  borderColor: active ? hexToRgba(accent, 0.7) : '#1A2A45',
                },
              ]}
            >
              <Text style={styles.emojiTabIcon}>{c.tab}</Text>
              <Text
                style={[
                  styles.emojiTabLabel,
                  { color: active ? '#F1F5F9' : '#6B8BA4' },
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.emojiGrid}>
        {cat.emojis.map((e, i) => {
          const selected = e === emoji;
          return (
            <Pressable
              key={`${cat.id}-${i}`}
              onPress={() => onPick(e)}
              style={[
                styles.emojiCell,
                {
                  backgroundColor: selected ? hexToRgba(accent, 0.18) : '#0A1628',
                  borderColor: selected ? hexToRgba(accent, 0.7) : '#1A2A45',
                },
              ]}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Section({
  label,
  hint,
  hintColor,
  children,
}: {
  label: string;
  hint?: string;
  hintColor?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
        {hint && (
          <Text
            style={[
              styles.sectionHint,
              hintColor ? { color: hintColor } : null,
            ]}
          >
            {hint}
          </Text>
        )}
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
  styleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  styleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  styleBtnSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  styleBtnEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  styleBtnLabel: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '500',
  },
  styleBtnChevron: {
    color: '#6B8BA4',
    fontSize: 11,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#0E1A2C',
  },
  emojiPicker: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#0E1A2C',
  },
  emojiTabsRow: {
    gap: 6,
    paddingBottom: 10,
    paddingRight: 8,
  },
  emojiTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  emojiTabIcon: {
    fontSize: 14,
    lineHeight: 16,
  },
  emojiTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  submitError: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 10,
    textAlign: 'center',
  },
  submitText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
});
