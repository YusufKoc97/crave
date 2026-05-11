import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  isAssistantConfigured,
  streamAssistantMessage,
  type ChatMessage,
} from '@/lib/assistant';
import { useKeyboardShortcut } from '@/lib/useKeyboardShortcut';

type LocalMessage = ChatMessage & { id: string };

export default function AssistantScreen() {
  const configured = isAssistantConfigured();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<LocalMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = async () => {
    const trimmed = input.trim();
    if (trimmed.length === 0 || thinking) return;
    const userMsg: LocalMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setThinking(true);
    setError(null);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Streaming: append an empty assistant message immediately, then
    // patch its content as deltas arrive. The user sees tokens land in
    // place instead of waiting for the full reply.
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ]);

    try {
      await streamAssistantMessage(
        nextHistory.map(({ role, content }) => ({ role, content })),
        {
          signal: ctrl.signal,
          onChunk: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + delta } : m
              )
            );
          },
        }
      );
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      // Drop the empty / partial assistant bubble on failure; the user
      // sees an error toast/banner and can retry from a clean state.
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setError(
        (e as Error).message ?? 'Yardımcı şu an cevap veremiyor. Tekrar dene.'
      );
    } finally {
      setThinking(false);
    }
  };

  // Auto-scroll on new messages.
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true })
    );
  }, [messages.length, thinking]);

  useKeyboardShortcut({
    onEscape: () => router.back(),
    onSubmit: () => send(),
  });

  if (!configured) {
    return (
      <View style={styles.root}>
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
          <Text style={styles.headerTitle}>Yardımcı</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.setupBody}>
          <View style={styles.setupBadge}>
            <Ionicons name="construct-outline" size={20} color="#7DC3FF" />
          </View>
          <Text style={styles.setupTitle}>Yardımcı henüz ayarlı değil</Text>
          <Text style={styles.setupBody2}>
            Bu özellik bir Supabase Edge Function'a (assistant) ihtiyaç duyuyor.
            Anthropic API anahtarın orada saklanıyor; uygulama sadece konuşmayı
            oraya gönderiyor.
          </Text>
          <Text style={styles.setupHint}>
            Kurduktan sonra .env.local'a şunu ekle:
          </Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText} selectable>
              EXPO_PUBLIC_ASSISTANT_URL=https://...supabase.co/functions/v1/assistant
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Text style={styles.iconBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Yardımcı</Text>
        <View style={styles.iconBtn} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <Bubble message={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyOrb} />
            <Text style={styles.emptyTitle}>Burada güvende konuşabilirsin</Text>
            <Text style={styles.emptyBody}>
              Bir dürtü mü hissettin, ya da sadece konuşmak mı istiyorsun? Ne
              olursa, bir tarafa yazmaya başla.
            </Text>
          </View>
        }
        ListFooterComponent={
          // Show the spinner only while we're waiting for the first
          // delta. Once tokens start landing they're visible inside the
          // streaming bubble itself, so the footer would just be noise.
          thinking &&
          (messages.length === 0 ||
            messages[messages.length - 1]?.content.length === 0) ? (
            <View style={styles.thinkingRow}>
              <ActivityIndicator size="small" color="#7DC3FF" />
              <Text style={styles.thinkingText}>Yardımcı düşünüyor...</Text>
            </View>
          ) : null
        }
      />

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Şu an ne hissediyorsun?"
          placeholderTextColor="#3D5470"
          style={styles.input}
          multiline
          maxLength={1000}
          editable={!thinking}
          onSubmitEditing={send}
          submitBehavior="submit"
        />
        <Pressable
          onPress={send}
          disabled={input.trim().length === 0 || thinking}
          accessibilityRole="button"
          accessibilityLabel="Mesajı gönder"
          accessibilityState={{
            disabled: input.trim().length === 0 || thinking,
          }}
          style={[
            styles.sendBtn,
            input.trim().length === 0 || thinking
              ? styles.sendBtnIdle
              : styles.sendBtnActive,
          ]}
          hitSlop={6}
        >
          <Ionicons name="arrow-up" size={18} color="#020810" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: LocalMessage }) {
  const isUser = message.role === 'user';
  return (
    <View
      style={[
        styles.bubbleWrap,
        { alignItems: isUser ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={isUser ? styles.bubbleUserText : styles.bubbleAssistantText}
        >
          {message.content}
        </Text>
      </View>
    </View>
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
    // Tiny inset highlight so the chip reads as a real lifted surface
    // against the page bg, matching tabs / profile chips.
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
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
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 80,
  },
  emptyOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
    marginBottom: 18,
    // Soft accent breath so the empty-state orb hints at the brand
    // ring on the home screen — invitational, not loud.
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 2,
    boxShadow:
      '0 0 12px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  emptyTitle: {
    color: '#F1F5F9',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  bubbleWrap: {
    width: '100%',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
    // Soft accent halo so the user's own message reads as "lit from
    // the right edge" — a directional cue without over-styling.
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
    boxShadow:
      '0 0 8px rgba(59, 130, 246, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  bubbleAssistant: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    // Just a 1px inset highlight on the receiving bubble — recessed,
    // not lit. Lets the user bubble carry all the visual weight.
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  bubbleUserText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleAssistantText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingHorizontal: 4,
  },
  thinkingText: {
    color: '#7BA8C8',
    fontSize: 12,
    fontStyle: 'italic',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 18,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
  },
  errorText: {
    flex: 1,
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 26,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#F1F5F9',
    fontSize: 14,
    lineHeight: 19,
    // Inset highlight matches auth + onboarding inputs — single
    // recessed-surface treatment across the app.
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#7DC3FF',
    // Accent halo on the live send button so the action feels primed.
    // Pairs with the user-bubble glow so the right-hand column reads
    // as the "user-action" axis of the screen.
    shadowColor: '#7DC3FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
    boxShadow:
      '0 0 10px rgba(125, 195, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
  },
  sendBtnIdle: {
    backgroundColor: '#7DC3FF',
    opacity: 0.4,
  },
  setupBody: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    alignItems: 'center',
  },
  setupBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    // Same soft accent breath as emptyOrb — keeps the two
    // "introduce-yourself" states visually consistent.
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 2,
    boxShadow:
      '0 0 12px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  setupTitle: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  setupBody2: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  setupHint: {
    marginTop: 22,
    color: '#6B8BA4',
    fontSize: 11.5,
    letterSpacing: 0.4,
  },
  codeBlock: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    backgroundColor: '#0A1628',
    width: '100%',
    // Inset highlight so the env var line reads as a recessed inset
    // panel, not a flat rectangle stuck on the page bg.
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  codeText: {
    color: '#7DC3FF',
    fontSize: 11,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
});
