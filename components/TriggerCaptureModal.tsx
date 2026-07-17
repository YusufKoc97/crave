import { useMemo, useState } from 'react';
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
import {
  dsColors,
  dsFont,
  dsRadius,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import { t } from '@/lib/i18n';
import type { Outcome } from '@/shared/scoring';

/**
 * Faz 5 REVERSAL — post-outcome trigger capture.
 *
 * Fires from both the resist flow (after IntensityModal) and the
 * fail flow (immediately after "I Failed"). Mandatory min-1 pick
 * (Modül 3's data feed is the whole point of this reversal —
 * every resolved session must carry ≥1 trigger).
 *
 * Cancel keeps the timer alive with no side effects. Only the
 * Save button hits the network — active-session's onTriggerCommit
 * takes it from there.
 *
 * Layout mirrors the (now-deleted) `/craving-start` chip grid so
 * users who already learned that flow see the same shapes.
 */

type Props = {
  visible: boolean;
  accentColor: string;
  addictionId: string;
  addictionName: string;
  /** Only used to tune copy — 'resisted' celebrates, 'failed'
   *  stays neutral. Null while the modal is hidden. */
  outcome: Outcome | null;
  onCommit: (triggerIds: string[]) => void;
  onCancel: () => void;
};

export function TriggerCaptureModal({
  visible,
  accentColor,
  addictionId,
  addictionName,
  outcome,
  onCommit,
  onCancel,
}: Props) {
  const specificTriggers = useMemo(
    () => triggersFor(addictionId),
    [addictionId]
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canSave = selected.size > 0;

  // Reset when the modal opens for a fresh outcome — the previous
  // pick set shouldn't leak into the next craving.
  const [lastVisible, setLastVisible] = useState(false);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setSelected(new Set());
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const titleKey =
    outcome === 'resisted'
      ? 'trigger_capture.resist_title'
      : 'trigger_capture.fail_title';
  const bodyKey =
    outcome === 'resisted'
      ? 'trigger_capture.resist_body'
      : 'trigger_capture.fail_body';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t(titleKey)}</Text>
            <Pressable
              onPress={onCancel}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('trigger_capture.cancel')}
            >
              <Ionicons name="close" size={20} color={dsColors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.hint}>
              {t(bodyKey, { name: addictionName })}
            </Text>

            <Text style={styles.subsectionLabel}>
              {t('trigger_capture.common_section')}
            </Text>
            <View style={styles.chipRow}>
              {COMMON_TRIGGERS.map((trigger) => (
                <TriggerChip
                  key={trigger.id}
                  trigger={trigger}
                  isSelected={selected.has(trigger.id)}
                  accentColor={accentColor}
                  onToggle={() => toggle(trigger.id)}
                />
              ))}
            </View>

            {specificTriggers.length > 0 && (
              <>
                <Text style={styles.subsectionLabel}>
                  {t('trigger_capture.specific_section', {
                    name: addictionName,
                  })}
                </Text>
                <View style={styles.chipRow}>
                  {specificTriggers.map((trigger) => (
                    <TriggerChip
                      key={trigger.id}
                      trigger={trigger}
                      isSelected={selected.has(trigger.id)}
                      accentColor={accentColor}
                      onToggle={() => toggle(trigger.id)}
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              disabled={!canSave}
              onPress={() => canSave && onCommit(Array.from(selected))}
              style={[
                styles.saveBtn,
                canSave
                  ? {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    }
                  : styles.saveBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
            >
              <Text
                style={[
                  styles.saveText,
                  canSave ? styles.saveTextEnabled : styles.saveTextDisabled,
                ]}
              >
                {t('trigger_capture.save')}
              </Text>
            </Pressable>
            {!canSave && (
              <Text style={styles.minHint}>
                {t('trigger_capture.min_one_trigger')}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dsColors.bgBase,
    borderTopLeftRadius: dsRadius.modalTop,
    borderTopRightRadius: dsRadius.modalTop,
    maxHeight: '85%',
    minHeight: '55%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: dsSpacing.xl,
    paddingTop: dsSpacing.xxl,
    paddingBottom: dsSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: dsColors.borderSubtle,
  },
  headerTitle: {
    color: dsColors.textPrimary,
    fontSize: dsFont.size.heading,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: dsRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dsColors.cardSurface,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: dsSpacing.xl,
    paddingBottom: dsSpacing.x3l,
  },
  hint: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.body,
    lineHeight: 21,
    marginBottom: dsSpacing.xxl,
  },
  subsectionLabel: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.tiny,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.caps,
    textTransform: 'uppercase',
    marginTop: dsSpacing.md,
    marginBottom: dsSpacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dsSpacing.sm,
    marginBottom: dsSpacing.md,
  },
  chip: {
    paddingHorizontal: dsSpacing.lg,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
  },
  chipIdle: {
    borderColor: dsColors.borderSubtle,
    backgroundColor: dsColors.cardSurface,
  },
  chipText: {
    fontSize: dsFont.size.label,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  chipTextIdle: {
    color: dsColors.textSecondary,
  },
  footer: {
    padding: dsSpacing.xl,
    paddingBottom: dsSpacing.x3l,
    borderTopWidth: 1,
    borderTopColor: dsColors.borderSubtle,
  },
  saveBtn: {
    height: 56,
    borderRadius: dsRadius.button,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: dsColors.cardSurface,
    borderColor: dsColors.borderSubtle,
  },
  saveText: {
    fontSize: dsFont.size.heading,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  saveTextEnabled: {
    color: dsColors.textPrimary,
  },
  saveTextDisabled: {
    color: dsColors.textTertiary,
  },
  minHint: {
    marginTop: dsSpacing.md,
    color: dsColors.textTertiary,
    fontSize: dsFont.size.label,
    textAlign: 'center',
  },
});
