import { useEffect } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  ADDICTION_TRIGGERS,
  COMMON_TRIGGERS,
  triggerLabel,
} from '@/constants/triggerCatalog';
import type { TriggerMapTrigger } from '@/lib/triggerMap';
import { t } from '@/lib/i18n';
import { triggersBorder, triggersSurface } from './triggersTheme';
import { useTriggersAccent } from './triggersAccent';
import { CardAura, CountUpText, useCardEntrance } from './triggersMotion';

/**
 * Trigger Distribution — Modül 3 redesign.
 *
 * Horizontal bar chart of trigger frequency:
 *   [dot + label]      [filled bar (barGrow)]      [percent + intensity]
 *
 * • Dot colour derives from the trigger id (via the accent context's
 *   `colorFor`) so the eye can match the same trigger across insight
 *   cards and heatmap detail sheets.
 * • Top row's percentage renders in the addiction accent; the rest in
 *   soft white — a subtle "leader" signal without shouting.
 * • Bars animate in from left (scaleX) with a staggered delay per
 *   row, and the percentages count up alongside them. Reduced-motion
 *   → instant.
 *
 * `most_common_intensity` is a server-side mode; the client only
 * renders "Mostly {{level}}".
 */

type Props = {
  triggers: TriggerMapTrigger[];
  addictionId: string;
  periodLabel: string;
  /** Position in the pane's card stack — drives the entrance stagger. */
  index?: number;
};

/**
 * Trigger label resolver — try the common set first, then the
 * addiction-specific set, and finally fall back to the raw id.
 * Same policy as `heroData.ts` so insight card copy and the
 * distribution list agree on labels.
 */
function resolveTriggerLabel(id: string, addictionId: string): string {
  if (COMMON_TRIGGERS.some((row) => row.id === id)) {
    return triggerLabel({ id, scope: 'common', displayOrder: 0 });
  }
  const list = ADDICTION_TRIGGERS[addictionId] ?? [];
  if (list.some((row) => row.id === id)) {
    return triggerLabel({ id, scope: addictionId, displayOrder: 0 });
  }
  return id;
}

export function TriggerDistribution({
  triggers,
  addictionId,
  periodLabel,
  index = 0,
}: Props) {
  const { accent, alpha, colorFor } = useTriggersAccent();
  const entrance = useCardEntrance(index);

  const cardStyle = [
    styles.wrap,
    {
      borderColor: triggersBorder(accent),
      ...Platform.select({
        web: { boxShadow: `0 8px 26px ${alpha(0.14)}` },
        default: { shadowColor: accent },
      }),
    },
    entrance,
  ];

  if (triggers.length === 0) {
    return (
      <Animated.View style={cardStyle}>
        <CardAura intensity={0.15} size={190} />
        <Text style={styles.title}>
          {t('trigger_map.distribution.title', { period: periodLabel })}
        </Text>
        <Text style={styles.emptyText}>
          {t('trigger_map.distribution.no_triggers')}
        </Text>
      </Animated.View>
    );
  }

  // Normalise bar widths against the strongest trigger — visually
  // more informative than raw % when the top one dominates.
  const topPct = triggers[0]?.percentage ?? 1;

  return (
    <Animated.View style={cardStyle}>
      <CardAura intensity={0.15} size={190} />
      <Text style={styles.title}>
        {t('trigger_map.distribution.title', { period: periodLabel })}
      </Text>
      {triggers.map((row, i) => {
        const label = resolveTriggerLabel(row.trigger_id, addictionId);
        const relative = topPct > 0 ? row.percentage / topPct : 0;
        const dotColor = colorFor(row.trigger_id);
        const isTop = i === 0;
        return (
          <DistributionRow
            key={row.trigger_id}
            index={i}
            label={label}
            dotColor={dotColor}
            relativeWidth={relative}
            percent={row.percentage}
            intensityKey={row.most_common_intensity}
            isTop={isTop}
            accent={accent}
            accentAlpha={alpha}
          />
        );
      })}
    </Animated.View>
  );
}

function DistributionRow({
  index,
  label,
  dotColor,
  relativeWidth,
  percent,
  intensityKey,
  isTop,
  accent,
  accentAlpha,
}: {
  index: number;
  label: string;
  dotColor: string;
  relativeWidth: number; // 0..1
  percent: number;
  intensityKey: TriggerMapTrigger['most_common_intensity'];
  isTop: boolean;
  accent: string;
  accentAlpha: (a: number) => string;
}) {
  // Reanimated scaleX for the barGrow effect (transform-only so it
  // stays on the UI thread).
  const grow = useSharedValue(0);
  const width = Math.max(0.02, Math.min(1, relativeWidth));

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        grow.value = width;
      } else {
        grow.value = withDelay(
          80 + index * 90,
          withTiming(width, {
            duration: 620,
            easing: Easing.out(Easing.cubic),
          })
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [width, index, grow]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: grow.value }],
  }));

  const intensityText = intensityKey
    ? t('trigger_map.distribution.mostly', {
        level: t(`trigger_map.intensity_levels.${intensityKey}`),
      })
    : null;

  return (
    <View style={styles.row}>
      <View style={styles.labelBlock}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: dotColor,
              shadowColor: dotColor,
            },
          ]}
        />
        <Text style={styles.labelText} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            barStyle,
            {
              backgroundColor: isTop ? accent : accentAlpha(0.55),
            },
          ]}
        />
      </View>
      <View style={styles.rightCol}>
        {/* Counts up in step with its own bar growing. */}
        <CountUpText
          value={percent}
          delay={80 + index * 90}
          format={(n) => t('trigger_map.distribution.percent', { percent: n })}
          style={[styles.percentText, { color: isTop ? accent : '#E1E7F5' }]}
        />
        {intensityText ? (
          <View style={styles.intensityRow}>
            <View style={[styles.miniDot, { backgroundColor: dotColor }]} />
            <Text style={styles.intensityText} numberOfLines={1}>
              {intensityText}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: triggersSurface.bg,
    borderWidth: 1,
    borderRadius: triggersSurface.radius,
    padding: 16,
    // Clips the CardAura bloom to the rounded corners.
    overflow: 'hidden',
    // Accent-dependent colours are applied inline at the call site.
    ...Platform.select({
      web: {},
      default: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 3,
      },
    }),
  },
  title: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 14,
  },
  emptyText: {
    color: '#6B8BA4',
    fontSize: 12.5,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  labelBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 118,
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 0 6px currentColor',
      },
      default: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 4,
      },
    }),
  },
  labelText: {
    color: '#F1F5F9',
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    // scaleX pivots from the left so bars grow rightward.
    transformOrigin: 'left center',
    width: '100%',
  },
  rightCol: {
    width: 92,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  percentText: {
    fontSize: 12.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  intensityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  miniDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  intensityText: {
    color: '#94A3B8',
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
});
