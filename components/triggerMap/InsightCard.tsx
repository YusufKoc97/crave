import { useMemo } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/lib/i18n';
import { INSIGHT_CATEGORY_ICON } from '@/constants/insights';
import {
  ADDICTION_TRIGGERS,
  COMMON_TRIGGERS,
  triggerLabel,
} from '@/constants/triggerCatalog';
import { TOOLKIT_TECHNIQUES } from '@/constants/toolkitCatalog';
import type { TriggerMapInsight } from '@/lib/triggerMap';

// Android needs opt-in for LayoutAnimation.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Faz 8b — one insight card. Icon + text + optional detail toggle
 * + optional action button.
 *
 * Trigger and technique IDs come as raw strings from the server
 * (karar #4). We resolve them client-side so an i18n copy tweak
 * never needs a function redeploy.
 *
 * Accordion: only one card open at a time. That state is lifted
 * to InsightSection which passes `expanded` down.
 */

type Props = {
  insight: TriggerMapInsight;
  addictionId: string;
  accentColor: string;
  expanded: boolean;
  onToggle: () => void;
  onAction?: (actionKey: string, params?: Record<string, string>) => void;
};

export function InsightCard({
  insight,
  addictionId,
  accentColor,
  expanded,
  onToggle,
  onAction,
}: Props) {
  // Resolve the raw IDs the server may pass in interpolation to
  // human-friendly labels. `t()` is idempotent for unknown keys
  // (returns the key), so this stays safe if a rule ever emits a
  // shape the client hasn't seen.
  const interpolation = useMemo(
    () => resolveInterpolation(insight, addictionId),
    [insight, addictionId]
  );

  const iconName = INSIGHT_CATEGORY_ICON[insight.category];
  const hasDetail = !!insight.detailKey;
  const hasAction = !!insight.actionKey;
  const message = t(insight.templateKey, interpolation);
  const detailText = insight.detailKey
    ? t(insight.detailKey, interpolation)
    : '';

  const handleToggleDetail = () => {
    if (!hasDetail) return;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(180, 'easeInEaseOut', 'opacity')
    );
    onToggle();
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={handleToggleDetail}
        disabled={!hasDetail}
        accessibilityRole={hasDetail ? 'button' : undefined}
        style={styles.header}
      >
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: hexAlpha(accentColor, 0.14),
              borderColor: hexAlpha(accentColor, 0.35),
            },
          ]}
        >
          <Ionicons name={iconName} size={16} color={accentColor} />
        </View>
        <Text style={styles.message}>{message}</Text>
        {hasDetail ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#6B8BA4"
            style={styles.chevron}
          />
        ) : null}
      </Pressable>
      {hasDetail && expanded ? (
        <Text style={styles.detail}>{detailText}</Text>
      ) : null}
      {hasAction ? (
        <Pressable
          onPress={() =>
            onAction?.(insight.actionKey!, insight.actionParams ?? {})
          }
          style={({ pressed }) => [
            styles.action,
            {
              borderColor: hexAlpha(accentColor, 0.55),
              backgroundColor: hexAlpha(accentColor, pressed ? 0.16 : 0.08),
            },
          ]}
        >
          <Text style={[styles.actionText, { color: accentColor }]}>
            {t(`insights.action.${insight.actionKey}`)}
          </Text>
          <Ionicons name="arrow-forward" size={13} color={accentColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Wire-safe interpolation resolver. Server sends raw IDs (karar
 * #4) so this is where we turn `stress` into "Stress" and
 * `breathing_478` into "4-7-8 Breathing".
 *
 * Anything the resolver doesn't recognise (unknown trigger id
 * from a future addiction, etc.) falls through as-is — the
 * template still renders instead of showing an empty slot.
 */
function resolveInterpolation(
  insight: TriggerMapInsight,
  addictionId: string
): Record<string, string | number> {
  const src = insight.interpolation ?? {};
  const out: Record<string, string | number> = { ...src };
  if (typeof src.trigger === 'string') {
    out.trigger = resolveTriggerLabel(src.trigger, addictionId);
  }
  if (typeof src.technique === 'string') {
    const tech = TOOLKIT_TECHNIQUES.find((row) => row.id === src.technique);
    out.technique = tech
      ? t(`toolkit.techniques.${tech.id}.name`)
      : String(src.technique);
  }
  return out;
}

function resolveTriggerLabel(id: string, addictionId: string): string {
  // Common triggers first — most rules will land here.
  if (COMMON_TRIGGERS.some((row) => row.id === id)) {
    return triggerLabel({ id, scope: 'common', displayOrder: 0 });
  }
  const list = ADDICTION_TRIGGERS[addictionId] ?? [];
  if (list.some((row) => row.id === id)) {
    return triggerLabel({ id, scope: addictionId, displayOrder: 0 });
  }
  return id;
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  message: {
    color: '#F1F5F9',
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
    flex: 1,
  },
  chevron: {
    marginLeft: 4,
    flexShrink: 0,
  },
  detail: {
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 10,
    paddingLeft: 44, // align under message, past the icon
  },
  action: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
