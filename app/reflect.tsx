import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { REFLECTION_MAX_LEN, createReflection } from '@/lib/reflections';
import { useKeyboardShortcut } from '@/lib/useKeyboardShortcut';
import { hapticCommit } from '@/lib/haptics';

/**
 * Reflection compose modal. Reached from the active-session share
 * banner (win) or directly after a gave_in. Params:
 *
 *   - sessionId? — DB row id of the craving session (may be absent
 *     in DEV bypass; the FK is nullable on purpose)
 *   - addictionId — preset id or 'custom-…'
 *   - addictionName — display label
 *   - emoji
 *   - color
 *   - outcome — 'resisted' or 'gave_in'
 *
 * Notes are private (RLS owner-only), short (1-500 chars), and write-
 * once. The header copy nudges differently on win vs loss to match the
 * recovery-tone language CLAUDE.md asks for.
 */
export default function ReflectScreen() {
  const params = useLocalSearchParams<{
    sessionId?: string;
    addictionId?: string;
    addictionName?: string;
    emoji?: string;
    color?: string;
    outcome?: 'resisted' | 'gave_in';
  }>();

  const { user } = useAuth();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const accent = params.color ?? '#3B82F6';
  const outcome = params.outcome === 'gave_in' ? 'gave_in' : 'resisted';
  const trimmedLen = note.trim().length;
  const canSubmit =
    !submitting && trimmedLen > 0 && note.length <= REFLECTION_MAX_LEN;

  const submit = async () => {
    if (!canSubmit) return;
    if (!user) {
      // DEV bypass — show a friendly note instead of throwing.
      toast.info('Giriş yaptıktan sonra notlar kaydedilir.');
      router.back();
      return;
    }
    if (!params.addictionId) {
      toast.error('Bağımlılık bilgisi eksik.');
      return;
    }
    hapticCommit();
    setSubmitting(true);
    try {
      await createReflection({
        userId: user.id,
        sessionId: params.sessionId ?? null,
        addictionId: params.addictionId,
        outcome,
        note,
      });
      toast.success('Not kaydedildi');
      router.back();
    } catch (e) {
      toast.error((e as Error).message ?? 'Kaydedilemedi. Tekrar dene.');
      setSubmitting(false);
    }
  };

  useKeyboardShortcut({
    onEscape: () => router.back(),
    onSubmit: () => submit(),
  });

  // Copy that shifts with the outcome — celebratory tone for wins,
  // dignified-not-pitying tone for losses.
  const headerCopy =
    outcome === 'resisted' ? 'Bu anı kendine bırak' : 'Bu an ne öğretti?';
  const subtitleCopy =
    outcome === 'resisted'
      ? 'Şu an neredeydin, ne yardımcı oldu? Sadece sen göreceksin.'
      : 'Yargılamadan yaz. Bir not seni gelecekteki bir anda tetikleyiciyi anlamana yardım edebilir.';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
        >
          <Text style={styles.iconBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Not</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {params.emoji && params.addictionName && (
          <View
            style={[
              styles.addictionChip,
              {
                borderColor: `${accent}55`,
                backgroundColor: `${accent}14`,
              },
            ]}
          >
            <Text style={styles.chipEmoji}>{params.emoji}</Text>
            <Text style={styles.chipName}>{params.addictionName}</Text>
            <Text
              style={[
                styles.chipOutcome,
                { color: outcome === 'resisted' ? '#10B981' : '#94A3B8' },
              ]}
            >
              {outcome === 'resisted' ? 'direndim' : 'verdim'}
            </Text>
          </View>
        )}

        <Text style={styles.title}>{headerCopy}</Text>
        <Text style={styles.subtitle}>{subtitleCopy}</Text>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Şu an aklımdan geçen…"
          placeholderTextColor="#3D5470"
          style={[
            styles.input,
            {
              borderColor: note ? `${accent}66` : '#1A2A45',
            },
          ]}
          multiline
          autoFocus
          maxLength={REFLECTION_MAX_LEN + 50}
          textAlignVertical="top"
        />
        <Text
          style={[
            styles.counter,
            { color: note.length > REFLECTION_MAX_LEN ? '#EF4444' : '#6B8BA4' },
          ]}
        >
          {note.length} / {REFLECTION_MAX_LEN}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[
            styles.submitBtn,
            {
              borderColor: canSubmit ? accent : '#1A2A45',
              backgroundColor: canSubmit ? `${accent}20` : '#080F1C',
              opacity: canSubmit ? 1 : 0.55,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Notu kaydet"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Text
              style={[
                styles.submitText,
                { color: canSubmit ? accent : '#3D5470' },
              ]}
            >
              Kaydet
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  addictionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 22,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipName: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '500',
  },
  chipOutcome: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 0.5,
    lineHeight: 28,
  },
  subtitle: {
    marginTop: 8,
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F1F5F9',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 140,
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 6,
  },
  submitBtn: {
    height: 52,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
});
