import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_ADDICTIONS } from '@/constants/addictions';
import {
  COMMUNITY_FILTER_ORDER,
  createPost,
  fetchPost,
  updatePost,
} from '@/lib/community';

const MAX_LEN = 500;
const PRESETS_BY_ID = Object.fromEntries(
  DEFAULT_ADDICTIONS.map((a) => [a.id, a])
);

export default function CommunityCompose() {
  const params = useLocalSearchParams<{
    prefill?: string;
    addictionId?: string;
    editId?: string;
  }>();
  const { user } = useAuth();

  const isEditMode = !!params.editId;

  const [hydrating, setHydrating] = useState(isEditMode);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialAddiction =
    params.addictionId && PRESETS_BY_ID[params.addictionId]
      ? params.addictionId
      : COMMUNITY_FILTER_ORDER[0];
  const [addictionId, setAddictionId] = useState<string>(initialAddiction);
  const [content, setContent] = useState(params.prefill ?? '');
  const [submitting, setSubmitting] = useState(false);

  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    if (!user || !isEditMode || !params.editId) return;
    (async () => {
      const post = await fetchPost(params.editId!, user.id);
      if (post && post.user_id === user.id) {
        setContent(post.content);
        setAddictionId(post.addiction_id);
      } else {
        // Post not found or not ours — drop back to the feed.
        router.back();
        return;
      }
      setHydrating(false);
    })();
  }, [user, isEditMode, params.editId]);

  const trimmedContent = content.trim();
  const remaining = MAX_LEN - content.length;
  const canSubmit =
    !!user &&
    !submitting &&
    trimmedContent.length > 0 &&
    content.length <= MAX_LEN;

  const submit = async () => {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEditMode && params.editId) {
        await updatePost({
          postId: params.editId,
          userId: user.id,
          content: trimmedContent,
        });
      } else {
        await createPost({
          userId: user.id,
          addictionId,
          content: trimmedContent,
        });
      }
      router.back();
    } catch {
      // Most likely a connection drop; the user has typed real content
      // and we don't want to silently strand them with a stuck button.
      setSubmitError(
        isEditMode
          ? 'Kaydedilemedi. Tekrar dene.'
          : 'Paylaşılamadı. Tekrar dene.'
      );
      setSubmitting(false);
    }
  };

  const accent = PRESETS_BY_ID[addictionId]?.color ?? '#3B82F6';

  if (hydrating) {
    return (
      <View style={styles.loaderRoot}>
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loaderRoot}>
        <Text style={styles.placeholderTitle}>Topluluk için kayıt ol</Text>
        <Pressable onPress={() => router.back()} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>Kapat</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.iconBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Gönderiyi Düzenle' : 'Yeni Gönderi'}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>BAĞIMLILIK</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pickerRow}
        >
          {COMMUNITY_FILTER_ORDER.map((id) => {
            const a = PRESETS_BY_ID[id];
            if (!a) return null;
            const selected = id === addictionId;
            // In edit mode the post's category is locked — keeping the
            // selected pill visible but non-interactive preserves context
            // without letting users churn the feed by re-tagging old posts.
            return (
              <Pressable
                key={id}
                onPress={() => !isEditMode && setAddictionId(id)}
                disabled={isEditMode && !selected}
                style={[
                  styles.pickerCell,
                  {
                    borderColor: selected
                      ? hexToRgba(a.color, 0.7)
                      : '#1A2A45',
                    backgroundColor: selected
                      ? hexToRgba(a.color, 0.14)
                      : '#0A1628',
                    opacity: isEditMode && !selected ? 0.35 : 1,
                  },
                ]}
              >
                <Text style={styles.pickerEmoji}>{a.emoji}</Text>
                <Text
                  style={[
                    styles.pickerLabel,
                    { color: selected ? hexToRgba(a.color, 0.95) : '#6B8BA4' },
                  ]}
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ height: 18 }} />

        <Text style={styles.sectionLabel}>METİN</Text>
        <TextInput
          value={content}
          onChangeText={(v) => setContent(v.slice(0, MAX_LEN + 50))}
          placeholder="Bugün ne hissediyorsun? Hangi anı paylaşmak istersin?"
          placeholderTextColor="#3D5470"
          style={[
            styles.contentInput,
            {
              borderColor:
                remaining < 0 ? '#EF4444' : content ? hexToRgba(accent, 0.4) : '#1A2A45',
            },
          ]}
          multiline
          textAlignVertical="top"
          autoFocus={!params.prefill}
        />
        <View style={styles.counterRow}>
          <Text
            style={[
              styles.counter,
              { color: remaining < 0 ? '#EF4444' : '#6B8BA4' },
            ]}
          >
            {content.length} / {MAX_LEN}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitError && (
          <Text style={styles.errorText}>{submitError}</Text>
        )}
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[
            styles.submitBtn,
            {
              borderColor: canSubmit ? accent : '#1A2A45',
              backgroundColor: canSubmit ? hexToRgba(accent, 0.12) : '#080F1C',
              opacity: canSubmit ? 1 : 0.55,
            },
          ]}
        >
          <Text style={[styles.submitText, { color: canSubmit ? accent : '#3D5470' }]}>
            {submitting
              ? isEditMode
                ? 'Kaydediliyor...'
                : 'Paylaşılıyor...'
              : isEditMode
                ? 'Kaydet'
                : 'Paylaş'}
          </Text>
        </Pressable>
      </View>
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
  loaderRoot: {
    flex: 1,
    backgroundColor: '#020810',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  placeholderTitle: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
  },
  dismissBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3050',
    backgroundColor: '#0D1E35',
  },
  dismissText: {
    color: '#7BA8C8',
    fontSize: 13,
  },
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
    paddingHorizontal: 18,
  },
  sectionLabel: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
  },
  pickerRow: {
    gap: 8,
    paddingRight: 18,
  },
  pickerCell: {
    width: 78,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pickerEmoji: {
    fontSize: 22,
  },
  pickerLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  contentInput: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F1F5F9',
    fontSize: 14,
    minHeight: 140,
  },
  counterRow: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  counter: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  footer: {
    paddingHorizontal: 18,
    paddingBottom: 26,
    paddingTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 10,
    textAlign: 'center',
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
