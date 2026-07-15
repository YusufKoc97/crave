import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticCommit, hapticTap } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import type { TechniqueScreenProps } from './types';

/**
 * 5-4-3-2-1 sensory grounding.
 *
 * Five steps, each asks the user to notice N items in a given
 * sense (see / touch / hear / smell / taste). Each step shows N
 * empty checkboxes; the user taps once per item observed. Once
 * every box on the current step is ticked, the primary button
 * enables — "Next" for steps 5 through 2, "Done" for step 1 (last
 * step is 1 taste). Tapping it advances to the next step or, on
 * the last step, calls onComplete.
 *
 * Fixed count schedule (Faz 6 karar #4 — no customisation MVP).
 */

type Step = {
  count: number;
  promptKey: string;
};

const STEPS: readonly Step[] = [
  { count: 5, promptKey: 'grounding.step_5' },
  { count: 4, promptKey: 'grounding.step_4' },
  { count: 3, promptKey: 'grounding.step_3' },
  { count: 2, promptKey: 'grounding.step_2' },
  { count: 1, promptKey: 'grounding.step_1' },
];

export function Grounding54321Screen({
  accentColor,
  onComplete,
}: TechniqueScreenProps) {
  const [stepIdx, setStepIdx] = useState(0);
  // Per-step set of ticked indices. Cleared every time the step
  // advances so the fresh screen starts with all boxes empty.
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  const step = STEPS[stepIdx];

  const toggle = useCallback((i: number) => {
    hapticTap();
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const allTicked = ticked.size >= step.count;
  const isLast = stepIdx === STEPS.length - 1;

  const advance = useCallback(() => {
    hapticCommit();
    if (isLast) {
      onComplete();
      return;
    }
    setStepIdx((i) => i + 1);
    setTicked(new Set());
  }, [isLast, onComplete]);

  const items = useMemo(
    () => Array.from({ length: step.count }, (_, i) => i),
    [step.count]
  );

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>{t('grounding.' + `step_${step.count}`)}</Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {items.map((i) => {
          const isTicked = ticked.has(i);
          return (
            <Pressable
              key={i}
              onPress={() => toggle(i)}
              style={[
                styles.item,
                isTicked
                  ? {
                      borderColor: accentColor,
                      backgroundColor: hexAlpha(accentColor, 0.12),
                    }
                  : styles.itemIdle,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isTicked }}
            >
              <View
                style={[
                  styles.checkbox,
                  isTicked
                    ? {
                        backgroundColor: accentColor,
                        borderColor: accentColor,
                      }
                    : styles.checkboxIdle,
                ]}
              >
                {isTicked && (
                  <Ionicons name="checkmark" size={16} color="#020810" />
                )}
              </View>
              <Text
                style={[styles.itemText, isTicked && { color: accentColor }]}
              >
                {t('grounding.checkbox_item')} #{i + 1}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!allTicked}
          onPress={advance}
          style={[
            styles.advanceBtn,
            allTicked
              ? {
                  borderColor: accentColor,
                  backgroundColor: hexAlpha(accentColor, 0.16),
                }
              : styles.advanceBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !allTicked }}
        >
          <Text
            style={[
              styles.advanceText,
              allTicked ? { color: accentColor } : styles.advanceTextDisabled,
            ]}
          >
            {isLast ? t('toolkit.done') : t('toolkit.next')}
          </Text>
        </Pressable>
      </View>
    </View>
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
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  intro: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 27,
    marginTop: 4,
    marginBottom: 22,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  itemIdle: {
    borderColor: '#1E2D4D',
    backgroundColor: '#0A1628',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxIdle: {
    borderColor: '#3D5470',
    backgroundColor: 'transparent',
  },
  itemText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  footer: {
    paddingTop: 12,
  },
  advanceBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceBtnDisabled: {
    borderColor: '#1A2A45',
    backgroundColor: '#080F1C',
    opacity: 0.5,
  },
  advanceText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  advanceTextDisabled: {
    color: '#3D5470',
  },
});
