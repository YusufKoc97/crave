import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ADDICTION_CATALOG,
  toAddiction,
  type AddictionCategory,
} from '@/constants/addictions';
import { useAddictions } from '@/context/AddictionsContext';
import { t } from '@/lib/i18n';

/**
 * Faz 2: this modal used to be the custom-addiction creator (name +
 * emoji + color + sensitivity picker). It's now a plain picker over
 * the 10-item catalog. No creation, no editing. User taps `Add` next
 * to a catalog row to activate it; if they're at the free-tier limit
 * every Add button greys out and a banner explains why.
 *
 * Rows are grouped by category (Substance / Behavioral / Digital) to
 * match the mock in the Faz 2 brief.
 */

const CATEGORY_ORDER: AddictionCategory[] = [
  'substance',
  'behavioral',
  'digital',
];

export default function AddictionPickerScreen() {
  const { activeIds, atLimit, addAddiction } = useAddictions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byCat: Record<AddictionCategory, typeof ADDICTION_CATALOG> = {
      substance: [],
      behavioral: [],
      digital: [],
    };
    for (const entry of ADDICTION_CATALOG) {
      byCat[entry.category] = [...byCat[entry.category], entry];
    }
    return byCat;
  }, []);

  const onAdd = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await addAddiction(id);
      // Dismiss the modal so the user lands back on the home orb with
      // the fresh addition already visible.
      router.back();
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong.');
      setBusyId(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('picker.title')}</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeBtn}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color="#94A3B8" />
        </Pressable>
      </View>

      {atLimit && (
        <View style={styles.limitBanner}>
          <Ionicons name="alert-circle-outline" size={14} color="#7DC3FF" />
          <Text style={styles.limitText}>
            {t('errors.addiction_limit_reached')}
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {CATEGORY_ORDER.map((cat) => (
          <View key={cat} style={styles.categoryGroup}>
            <Text style={styles.categoryHeader}>{t(`categories.${cat}`)}</Text>
            {grouped[cat].map((entry) => {
              const added = activeIds.has(entry.id);
              const disabled = added || (atLimit && !added) || busyId != null;
              const addiction = toAddiction(entry);
              return (
                <View key={entry.id} style={styles.row}>
                  <View
                    style={[
                      styles.emojiChip,
                      { backgroundColor: addiction.bgGlow },
                    ]}
                  >
                    <Text style={styles.emoji}>{entry.emoji}</Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{addiction.name}</Text>
                    <Text style={styles.rowDescription}>
                      {t(`addictions.${entry.id}.description`)}
                    </Text>
                  </View>
                  <Pressable
                    disabled={disabled}
                    onPress={() => onAdd(entry.id)}
                    style={[
                      styles.actionBtn,
                      added
                        ? styles.actionBtnAdded
                        : disabled
                          ? styles.actionBtnDisabled
                          : {
                              borderColor: entry.color,
                              backgroundColor: hexWithAlpha(entry.color, 0.14),
                            },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      added
                        ? t('picker.added_button')
                        : `${t('picker.add_button')} ${addiction.name}`
                    }
                  >
                    <Text
                      style={[
                        styles.actionText,
                        added
                          ? styles.actionTextAdded
                          : disabled
                            ? styles.actionTextDisabled
                            : { color: entry.color },
                      ]}
                    >
                      {added
                        ? t('picker.added_button')
                        : t('picker.add_button')}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2D4D',
  },
  title: {
    color: '#F1F5F9',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  limitText: {
    flex: 1,
    color: '#7DC3FF',
    fontSize: 12.5,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 12,
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
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  categoryGroup: {
    marginTop: 22,
  },
  categoryHeader: {
    color: '#6B8BA4',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginBottom: 10,
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    marginBottom: 8,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
  },
  emojiChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emoji: {
    fontSize: 20,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    color: '#F1F5F9',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  rowDescription: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: 11.5,
    lineHeight: 15,
  },
  actionBtn: {
    minWidth: 68,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnAdded: {
    borderColor: '#1E3050',
    backgroundColor: '#0D1E35',
  },
  actionBtnDisabled: {
    borderColor: '#1A2A45',
    backgroundColor: '#0A1628',
    opacity: 0.4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  actionTextAdded: {
    color: '#6B8BA4',
  },
  actionTextDisabled: {
    color: '#3D5470',
  },
});
