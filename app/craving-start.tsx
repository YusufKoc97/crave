import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCatalogEntry, toAddiction } from '@/constants/addictions';
import {
  COMMON_TRIGGERS,
  triggerLabel,
  triggersFor,
  type Trigger,
} from '@/constants/triggerCatalog';
import { maxMinutesFor } from '@/constants/addictions';
import { t } from '@/lib/i18n';

/**
 * Faz 5 — pre-timer capture screen. User arrives here from a tap
 * on their addiction tile; we surface the chosen addiction as a
 * read-only chip up top, then a multi-select trigger picker
 * (common + addiction-specific), then a Start button that only
 * enables once ≥ 1 trigger is picked.
 *
 * Trigger ids are passed to /active-session as a comma-separated
 * `triggers` param — the timer screen handles the INSERT into
 * `craving_session_triggers` after `craving_sessions` INSERT lands
 * (needs the session id).
 */
export default function CravingStartScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    emoji?: string;
    color?: string;
    sensitivity?: string;
  }>();

  const addictionId = params.id ?? '';
  const catalog = getCatalogEntry(addictionId);

  const addiction = useMemo(
    () => (catalog ? toAddiction(catalog) : null),
    [catalog]
  );

  const specificTriggers = useMemo(
    () => triggersFor(addictionId),
    [addictionId]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canStart = selected.size > 0 && !!addiction;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dismiss = () => router.back();

  const onStart = () => {
    if (!canStart || !addiction || !catalog) return;
    const triggerIds = Array.from(selected).join(',');
    // Timer screen expects the same shape home used to build; keep
    // the payload identical so a resume path doesn't diverge.
    // triggers is comma-joined because expo-router serialises
    // params as strings — parsed back in active-session.
    router.replace({
      pathname: '/active-session',
      params: {
        id: addiction.id,
        name: addiction.name,
        emoji: addiction.emoji,
        color: addiction.color,
        maxMinutes: String(maxMinutesFor(catalog.sensitivity)),
        sensitivity: String(catalog.sensitivity),
        triggers: triggerIds,
      },
    });
  };

  if (!addiction) {
    // Missing / unknown id — bounce back to the orb.
    return (
      <View style={styles.root}>
        <Header onClose={dismiss} accentColor="#3B82F6" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('info.section_all')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header onClose={dismiss} accentColor={addiction.color} />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Chosen addiction — read-only chip so the user has visual
            confirmation of what they picked without having to
            re-select. */}
        <Text style={styles.sectionLabel}>
          {t('craving_flow.select_addiction_label')}
        </Text>
        <View style={styles.addictionCard}>
          <View
            style={[
              styles.addictionEmojiChip,
              { backgroundColor: addiction.bgGlow },
            ]}
          >
            <Text style={styles.addictionEmoji}>{addiction.emoji}</Text>
          </View>
          <Text style={styles.addictionName}>{addiction.name}</Text>
          <Ionicons name="checkmark-circle" size={20} color={addiction.color} />
        </View>

        {/* Trigger sections */}
        <Text style={[styles.title]}>
          {t('craving_flow.select_triggers_title')}
        </Text>
        <Text style={styles.hint}>
          {t('craving_flow.select_triggers_hint')}
        </Text>

        <Text style={styles.subsectionLabel}>
          {t('craving_flow.common_section')}
        </Text>
        <View style={styles.chipRow}>
          {COMMON_TRIGGERS.map((trigger) => (
            <TriggerChip
              key={trigger.id}
              trigger={trigger}
              isSelected={selected.has(trigger.id)}
              accentColor={addiction.color}
              onToggle={() => toggle(trigger.id)}
            />
          ))}
        </View>

        {specificTriggers.length > 0 && (
          <>
            <Text style={styles.subsectionLabel}>
              {t('craving_flow.specific_section', { name: addiction.name })}
            </Text>
            <View style={styles.chipRow}>
              {specificTriggers.map((trigger) => (
                <TriggerChip
                  key={trigger.id}
                  trigger={trigger}
                  isSelected={selected.has(trigger.id)}
                  accentColor={addiction.color}
                  onToggle={() => toggle(trigger.id)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!canStart}
          onPress={onStart}
          style={[
            styles.startBtn,
            canStart
              ? {
                  borderColor: addiction.color,
                  backgroundColor: hexAlpha(addiction.color, 0.16),
                }
              : styles.startBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('craving_flow.start_button')}
          accessibilityState={{ disabled: !canStart }}
        >
          <Text
            style={[
              styles.startText,
              canStart ? { color: addiction.color } : styles.startTextDisabled,
            ]}
          >
            {t('craving_flow.start_button')}
          </Text>
        </Pressable>
        {!canStart && (
          <Text style={styles.minHint}>
            {t('craving_flow.min_one_trigger')}
          </Text>
        )}
      </View>
    </View>
  );
}

function Header({
  onClose,
  accentColor,
}: {
  onClose: () => void;
  accentColor: string;
}) {
  return (
    <View style={styles.header}>
      <Text style={[styles.headerTitle, { color: accentColor }]}>
        {t('craving_flow.start_title')}
      </Text>
      <Pressable
        onPress={onClose}
        hitSlop={10}
        style={styles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={20} color="#94A3B8" />
      </Pressable>
    </View>
  );
}

function TriggerChip({
  trigger,
  isSelected,
  accentColor,
  onToggle,
}: {
  trigger: Trigger;
  isSelected: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.chip,
        isSelected
          ? {
              borderColor: accentColor,
              backgroundColor: hexAlpha(accentColor, 0.14),
            }
          : styles.chipIdle,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
    >
      <Text
        style={[
          styles.chipText,
          isSelected ? { color: accentColor } : styles.chipTextIdle,
        ]}
      >
        {triggerLabel(trigger)}
      </Text>
    </Pressable>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2D4D',
  },
  headerTitle: {
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6B8BA4',
    fontSize: 13,
  },
  sectionLabel: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  addictionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    marginBottom: 26,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  addictionEmojiChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  addictionEmoji: {
    fontSize: 20,
  },
  addictionName: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 18,
  },
  subsectionLabel: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipIdle: {
    borderColor: '#1E2D4D',
    backgroundColor: '#0A1628',
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  chipTextIdle: {
    color: '#94A3B8',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#1E2D4D',
    backgroundColor: '#020810',
  },
  startBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnDisabled: {
    borderColor: '#1A2A45',
    backgroundColor: '#080F1C',
    opacity: 0.5,
  },
  startText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  startTextDisabled: {
    color: '#3D5470',
  },
  minHint: {
    marginTop: 10,
    color: '#6B8BA4',
    fontSize: 11.5,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
