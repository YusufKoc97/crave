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
import { useTriggerMap } from '@/lib/triggerMap';
import type { Outcome } from '@/shared/scoring';

/**
 * Faz 5 REVERSAL — post-outcome trigger capture.
 *
 * Fires from both the resist flow (after IntensityModal) and the
 * fail flow (immediately after "I Failed"). Mandatory min-1 pick
 * (Modül 3's data feed is the whole point of this reversal —
 * every resolved session must carry ≥1 trigger).
 *
 * Craving-capture redesign: the flat two-group chip grid is now
 * three regions. The user's own most frequent triggers of the last
 * 30 days come first as rows with frequency bars — most cravings
 * repeat, so the answer is usually already on screen — and the two
 * chip groups sit underneath for everything else. A live summary of
 * picks sits above the save button.
 *
 * A 3-tag cap replaces the previous unlimited selection. At the cap
 * unselected options drop to .34 and stop responding: no error copy,
 * no toast, the UI simply stops offering.
 *
 * The handoff's "+ Something else" free-text chip is deliberately
 * NOT here. `onCommit` carries trigger ids only and the resolve
 * payload has no field for prose, so shipping the control would
 * mean silently discarding whatever the user typed. It needs a
 * column and an Edge Function change first.
 *
 * Cancel keeps the outcome the previous screen already recorded;
 * only Save hits the network, via onTriggerCommit.
 */

const MAX_TAGS = 3;
/** How many of the user's own top triggers to surface. */
const TOP_N = 3;

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
  const [selected, setSelected] = useState<string[]>([]);

  // Server-side 30-day counts, already sorted count-desc by the
  // trigger-map Edge Function. Same query the Info tab runs, so it
  // is usually warm in the query cache by the time a craving ends.
  const { data: mapData } = useTriggerMap(addictionId, '30d');
  const topTriggers = useMemo(() => {
    const rows = mapData?.triggers ?? [];
    return rows.filter((r) => r.count > 0).slice(0, TOP_N);
  }, [mapData]);
  const topMax = topTriggers[0]?.count ?? 0;

  const atCap = selected.length >= MAX_TAGS;
  const canSave = selected.length > 0;

  // Reset when the modal opens for a fresh outcome — the previous
  // pick set shouldn't leak into the next craving.
  const [lastVisible, setLastVisible] = useState(false);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setSelected([]);
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, id];
    });
  };

  const remove = (id: string) =>
    setSelected((prev) => prev.filter((x) => x !== id));

  const saveLabel = canSave
    ? selected.length === 1
      ? t('trigger_capture.save_one')
      : t('trigger_capture.save_many', { count: String(selected.length) })
    : t('trigger_capture.save');

  // Outcome still tunes one line — the redesign fixes the header
  // copy, so the celebrate/neutral distinction moved down to the
  // hint above the chip groups rather than being dropped.
  const hintKey =
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
          {/* ── Header ─────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.stepRow}>
              <Text style={styles.stepLabel}>
                {t('trigger_capture.step_label')}
              </Text>
              <View style={styles.stepBars}>
                <View style={styles.stepBarDone} />
                <View
                  style={[styles.stepBar, { backgroundColor: accentColor }]}
                />
              </View>
              <View style={styles.stepSpacer} />
              <Pressable
                onPress={onCancel}
                hitSlop={10}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('trigger_capture.cancel')}
              >
                <Ionicons
                  name="close"
                  size={16}
                  color={dsColors.textSecondary}
                />
              </Pressable>
            </View>
            <Text style={styles.headerTitle}>{t('trigger_capture.title')}</Text>
            <Text style={styles.headerSubtitle}>
              {t('trigger_capture.subtitle')}
            </Text>
          </View>

          {/* ── Body ───────────────────────────────────────────── */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {topTriggers.length > 0 && (
              <>
                <SectionLabel
                  text={t('trigger_capture.usually_you')}
                  color={accentColor}
                  dot
                  trailing={t('trigger_capture.window_30d')}
                />
                <View style={styles.rows}>
                  {topTriggers.map((row) => {
                    const isSelected = selected.includes(row.trigger_id);
                    const dimmed = atCap && !isSelected;
                    return (
                      <FrequencyRow
                        key={row.trigger_id}
                        label={labelForId(row.trigger_id, addictionId)}
                        count={row.count}
                        ratio={topMax > 0 ? row.count / topMax : 0}
                        isSelected={isSelected}
                        dimmed={dimmed}
                        accentColor={accentColor}
                        onToggle={() => toggle(row.trigger_id)}
                      />
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.hint}>
              {t(hintKey, { name: addictionName })}
            </Text>

            <SectionLabel text={t('trigger_capture.how_you_felt')} />
            <View style={styles.chipRow}>
              {COMMON_TRIGGERS.map((trigger) => (
                <TriggerChip
                  key={trigger.id}
                  trigger={trigger}
                  isSelected={selected.includes(trigger.id)}
                  dimmed={atCap && !selected.includes(trigger.id)}
                  accentColor={accentColor}
                  onToggle={() => toggle(trigger.id)}
                />
              ))}
            </View>

            {specificTriggers.length > 0 && (
              <>
                <SectionLabel text={t('trigger_capture.the_moment')} />
                <View style={styles.chipRow}>
                  {specificTriggers.map((trigger) => (
                    <TriggerChip
                      key={trigger.id}
                      trigger={trigger}
                      isSelected={selected.includes(trigger.id)}
                      dimmed={atCap && !selected.includes(trigger.id)}
                      accentColor={accentColor}
                      onToggle={() => toggle(trigger.id)}
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          {/* ── Footer ─────────────────────────────────────────── */}
          <View style={styles.footer}>
            <View style={styles.summary}>
              {selected.length === 0 ? (
                <Text style={styles.summaryEmpty}>
                  {t('trigger_capture.empty_summary')}
                </Text>
              ) : (
                selected.map((id) => (
                  <Pressable
                    key={id}
                    onPress={() => remove(id)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: hexAlpha(accentColor, 0.14),
                        borderColor: hexAlpha(accentColor, 0.45),
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={labelForId(id, addictionId)}
                  >
                    <Text style={[styles.pillText, { color: accentColor }]}>
                      {labelForId(id, addictionId)}
                    </Text>
                    <Ionicons
                      name="close"
                      size={12}
                      color={hexAlpha(accentColor, 0.75)}
                    />
                  </Pressable>
                ))
              )}
            </View>

            <Pressable
              disabled={!canSave}
              onPress={() => canSave && onCommit(selected)}
              style={[
                styles.saveBtn,
                canSave
                  ? {
                      backgroundColor: hexAlpha(accentColor, 0.14),
                      borderColor: hexAlpha(accentColor, 0.45),
                    }
                  : styles.saveBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
            >
              <Text
                style={[
                  styles.saveText,
                  canSave ? { color: accentColor } : styles.saveTextDisabled,
                ]}
              >
                {saveLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Resolve a bare trigger id back to its display label. The map
 *  endpoint returns ids only, so both catalogs are searched. */
function labelForId(id: string, addictionId: string): string {
  const found =
    COMMON_TRIGGERS.find((x) => x.id === id) ??
    triggersFor(addictionId).find((x) => x.id === id);
  // Unknown ids can reach here: the catalog is client-only with no
  // DB constraint behind it, so an id retired from the catalog can
  // still come back from the 30-day query.
  return found ? triggerLabel(found) : id;
}

function SectionLabel({
  text,
  color,
  dot,
  trailing,
}: {
  text: string;
  color?: string;
  dot?: boolean;
  trailing?: string;
}) {
  return (
    <View style={styles.sectionRow}>
      {dot && (
        <View
          style={[
            styles.sectionDot,
            { backgroundColor: color ?? dsColors.textSecondary },
          ]}
        />
      )}
      <Text
        style={[styles.sectionLabel, color ? { color } : null]}
        numberOfLines={1}
      >
        {text}
      </Text>
      <View style={styles.sectionRule} />
      {trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}
    </View>
  );
}

function FrequencyRow({
  label,
  count,
  ratio,
  isSelected,
  dimmed,
  accentColor,
  onToggle,
}: {
  label: string;
  count: number;
  ratio: number;
  isSelected: boolean;
  dimmed: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={dimmed}
      style={[
        styles.row,
        isSelected
          ? {
              backgroundColor: hexAlpha(accentColor, 0.14),
              borderColor: hexAlpha(accentColor, 0.45),
            }
          : styles.rowIdle,
        dimmed && styles.dimmed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: dimmed }}
    >
      <Text
        style={[
          styles.rowLabel,
          isSelected ? { color: accentColor } : styles.rowLabelIdle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.freqTrack}>
        <View
          style={[
            styles.freqFill,
            {
              width: `${Math.max(6, Math.min(1, ratio) * 100)}%`,
              backgroundColor: isSelected ? accentColor : dsColors.borderAccent,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.freqCount,
          { color: isSelected ? accentColor : dsColors.textTertiary },
        ]}
      >
        {count}×
      </Text>
    </Pressable>
  );
}

function TriggerChip({
  trigger,
  isSelected,
  dimmed,
  accentColor,
  onToggle,
}: {
  trigger: Trigger;
  isSelected: boolean;
  dimmed: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={dimmed}
      style={[
        styles.chip,
        isSelected
          ? {
              borderColor: hexAlpha(accentColor, 0.45),
              backgroundColor: hexAlpha(accentColor, 0.14),
            }
          : styles.chipIdle,
        dimmed && styles.dimmed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: dimmed }}
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
    paddingHorizontal: dsSpacing.xl,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: dsColors.borderSubtle,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.sm,
  },
  stepLabel: {
    color: dsColors.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  stepBars: {
    flexDirection: 'row',
    gap: 4,
  },
  stepBar: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  stepBarDone: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: dsColors.borderAccent,
  },
  stepSpacer: {
    flex: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dsColors.cardSurface,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
  },
  headerTitle: {
    marginTop: 10,
    color: dsColors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    marginTop: 3,
    color: dsColors.textTertiary,
    fontSize: 12.5,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: dsSpacing.xl,
    paddingTop: dsSpacing.lg,
    paddingBottom: dsSpacing.sm,
  },
  hint: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.body,
    lineHeight: 21,
    marginTop: dsSpacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.sm,
    marginTop: dsSpacing.lg,
    marginBottom: dsSpacing.md,
  },
  sectionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  sectionLabel: {
    color: dsColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: '#16233C',
  },
  sectionTrailing: {
    color: dsColors.textTertiary,
    fontSize: 10.5,
  },
  rows: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.md,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
  },
  rowIdle: {
    backgroundColor: dsColors.cardSurface,
    borderColor: dsColors.borderSubtle,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  rowLabelIdle: {
    color: dsColors.textSecondary,
  },
  freqTrack: {
    width: 64,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#16233C',
    overflow: 'hidden',
  },
  freqFill: {
    height: 5,
    borderRadius: 3,
  },
  freqCount: {
    width: 26,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Cap reached: the option stays legible but visibly out of play.
  dimmed: {
    opacity: 0.34,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    borderWidth: 1,
  },
  chipIdle: {
    borderColor: dsColors.borderSubtle,
    backgroundColor: dsColors.cardSurface,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  chipTextIdle: {
    color: dsColors.textSecondary,
  },
  footer: {
    paddingHorizontal: dsSpacing.xl,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: dsColors.borderSubtle,
  },
  summary: {
    minHeight: 32,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  summaryEmpty: {
    color: dsColors.textTertiary,
    fontSize: 12.5,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: 12,
    height: 54,
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
    fontSize: 17,
    fontWeight: '600',
  },
  saveTextDisabled: {
    color: dsColors.textTertiary,
  },
});
