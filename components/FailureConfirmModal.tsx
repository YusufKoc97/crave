import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COMMON_TRIGGERS,
  triggerLabel,
  triggersFor,
  type Trigger,
} from '@/constants/triggerCatalog';
import { t } from '@/lib/i18n';

/**
 * Faz 5 — post-fail trigger confirmation. Opens after "I Failed"
 * is tapped, BEFORE the resolve-craving call. Pre-selects the
 * triggers the user picked at start; they can toggle chips to
 * revise, or cancel entirely (× top-right) — cancel leaves the
 * session `active` so the user can try again.
 *
 * Two commit paths:
 *   - "Looks right" → onConfirm(originalTriggers): resolve as-is
 *   - "Edit and save" → onConfirm(currentSelection): DELETE +
 *     INSERT before resolve (client-side, karar #3)
 * Both funnel to the same server call, just with different trigger
 * payloads.
 *
 * Also renders the shame-free message underneath the buttons —
 * shows AFTER commit intent so it doesn't feel like a lecture
 * before the user has made their decision.
 */

type Props = {
  visible: boolean;
  accentColor: string;
  addictionId: string;
  addictionName: string;
  /** Triggers the user selected on the craving-start screen. */
  initialTriggerIds: readonly string[];
  onConfirm: (triggerIds: string[], edited: boolean) => void;
  onCancel: () => void;
};

export function FailureConfirmModal({
  visible,
  accentColor,
  addictionId,
  addictionName,
  initialTriggerIds,
  onConfirm,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialTriggerIds)
  );

  // If the initial set changes between opens (e.g. user cancelled
  // once and revisits the same session), reset selection.
  useEffect(() => {
    if (visible) setSelected(new Set(initialTriggerIds));
  }, [visible, initialTriggerIds]);

  const specificTriggers = useMemo(
    () => triggersFor(addictionId),
    [addictionId]
  );

  const edited = useMemo(() => {
    if (selected.size !== initialTriggerIds.length) return true;
    for (const id of initialTriggerIds) {
      if (!selected.has(id)) return true;
    }
    return false;
  }, [selected, initialTriggerIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canConfirm = selected.size > 0;

  const onLooksRight = () => {
    // "Looks right" preserves the ORIGINAL selection even if the
    // user toggled anything mid-flight (they might have opened and
    // re-considered). Explicit-edit path is the other button.
    onConfirm(Array.from(initialTriggerIds), false);
  };

  const onEditAndSave = () => {
    if (!canConfirm) return;
    onConfirm(Array.from(selected), true);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('craving_flow.confirm_trigger_question')}
            </Text>
            <Pressable
              onPress={onCancel}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('craving_flow.cancel_button')}
            >
              <Ionicons name="close" size={18} color="#94A3B8" />
            </Pressable>
          </View>
          <Text style={styles.hint}>
            {t('craving_flow.confirm_trigger_hint')}
          </Text>

          <ScrollView
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.chipRow}>
              {COMMON_TRIGGERS.map((trigger) => (
                <ChipView
                  key={trigger.id}
                  trigger={trigger}
                  isSelected={selected.has(trigger.id)}
                  accentColor={accentColor}
                  onToggle={() => toggle(trigger.id)}
                />
              ))}
            </View>
            {specificTriggers.length > 0 && (
              <View style={[styles.chipRow, { marginTop: 8 }]}>
                {specificTriggers.map((trigger) => (
                  <ChipView
                    key={trigger.id}
                    trigger={trigger}
                    isSelected={selected.has(trigger.id)}
                    accentColor={accentColor}
                    onToggle={() => toggle(trigger.id)}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            {edited ? (
              <Pressable
                onPress={onEditAndSave}
                disabled={!canConfirm}
                style={[
                  styles.primaryBtn,
                  canConfirm
                    ? {
                        borderColor: accentColor,
                        backgroundColor: hexAlpha(accentColor, 0.16),
                      }
                    : styles.primaryBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('craving_flow.edit_button')}
              >
                <Text
                  style={[
                    styles.primaryText,
                    canConfirm
                      ? { color: accentColor }
                      : styles.primaryTextDisabled,
                  ]}
                >
                  {t('craving_flow.edit_button')}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onLooksRight}
                style={[
                  styles.primaryBtn,
                  {
                    borderColor: accentColor,
                    backgroundColor: hexAlpha(accentColor, 0.16),
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('craving_flow.confirm_button')}
              >
                <Text style={[styles.primaryText, { color: accentColor }]}>
                  {t('craving_flow.confirm_button')}
                </Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.shameFree}>
            {t('craving_flow.failed_message')}
          </Text>
          <Text style={styles.addictionSubtitle}>{addictionName}</Text>
        </View>
      </View>
    </Modal>
  );
}

function ChipView({
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#0A1628',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 20,
    boxShadow:
      '0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
  },
  hint: {
    color: '#94A3B8',
    fontSize: 12.5,
    marginBottom: 14,
  },
  chipScroll: {
    maxHeight: 260,
  },
  chipContent: {
    paddingBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipIdle: {
    borderColor: '#1E2D4D',
    backgroundColor: '#080F1C',
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  chipTextIdle: {
    color: '#94A3B8',
  },
  actions: {
    marginTop: 18,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    borderColor: '#1A2A45',
    backgroundColor: '#080F1C',
    opacity: 0.5,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  primaryTextDisabled: {
    color: '#3D5470',
  },
  shameFree: {
    marginTop: 14,
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  addictionSubtitle: {
    marginTop: 6,
    color: '#6B8BA4',
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
