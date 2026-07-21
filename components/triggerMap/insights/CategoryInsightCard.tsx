import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import {
  ArrowUpRight,
  Clock,
  Sparkles,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import type { TriggerMapInsight } from '@/lib/triggerMap';
import type { InsightCategory } from '@/shared/insightRules';
import {
  triggersColorFor,
  triggersHexAlpha,
  triggersSurface,
} from '../triggersTheme';
import { buildInsightPresentation } from './heroData';
import { MiniViz } from './MiniViz';

// Android LayoutAnimation opt-in.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Category insight card (secondary tier — below the hero).
 *
 * Design brief anatomy: 3px left color stripe → icon square →
 * TAG label → title → body → optional action → embedded mini viz
 * on the right. Trend badge (top-right) surfaces the salient
 * numeric so users can scan the whole stack at a glance without
 * expanding a single card.
 *
 * Colour: derives its accent from `category` (time / trigger /
 * technique / trend) so the eye can group similar insights across
 * the pane instead of drowning in a wall of violet.
 */

const CATEGORY_ICON: Record<InsightCategory, LucideIcon> = {
  time: Clock,
  trigger: Zap,
  technique: Wrench,
  trend: TrendingUp,
};

type Props = {
  insight: TriggerMapInsight;
  addictionId: string;
  expanded: boolean;
  onToggle: () => void;
  onAction?: (actionKey: string, params?: Record<string, string>) => void;
};

export function CategoryInsightCard({
  insight,
  addictionId,
  expanded,
  onToggle,
  onAction,
}: Props) {
  const p = buildInsightPresentation(insight, addictionId);
  const cardColor = triggersColorFor(insight.category);
  const IconComp = CATEGORY_ICON[insight.category] ?? Sparkles;
  const message = t(insight.templateKey, insight.interpolation ?? {});
  const detailText = insight.detailKey
    ? t(insight.detailKey, insight.interpolation ?? {})
    : '';
  const hasDetail = !!insight.detailKey;
  const hasAction = !!insight.actionKey;

  const handleToggleDetail = () => {
    if (!hasDetail) return;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(180, 'easeInEaseOut', 'opacity')
    );
    onToggle();
  };

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: triggersHexAlpha(cardColor, 0.22),
        },
      ]}
    >
      {/* 3px vertical color stripe pinned to the left edge. */}
      <View style={[styles.stripe, { backgroundColor: cardColor }]} />

      <View style={styles.body}>
        <View style={styles.headRow}>
          <View
            style={[
              styles.iconSquare,
              {
                backgroundColor: triggersHexAlpha(cardColor, 0.14),
                borderColor: triggersHexAlpha(cardColor, 0.35),
              },
            ]}
          >
            <IconComp size={16} color={cardColor} strokeWidth={2.2} />
          </View>
          <Text style={[styles.tag, { color: cardColor }]} numberOfLines={1}>
            {p.categoryLabel}
            <Text style={styles.tagDot}>{'  ·  '}</Text>
            {p.sublabel}
          </Text>
          {p.trend ? (
            <View
              style={[
                styles.trendChip,
                {
                  backgroundColor: triggersHexAlpha(cardColor, 0.12),
                  borderColor: triggersHexAlpha(cardColor, 0.35),
                },
              ]}
            >
              <Text style={[styles.trendText, { color: cardColor }]}>
                {p.trend.direction === 'up' ? '↑ ' : ''}
                {p.trend.label}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.contentRow}>
          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={2}>
              {message}
            </Text>
            {hasDetail && expanded ? (
              <Text style={styles.detailText}>{detailText}</Text>
            ) : null}
          </View>
          {p.viz !== 'none' ? (
            <View style={styles.vizWrap}>
              <MiniViz kind={p.viz} color={cardColor} width={64} height={30} />
            </View>
          ) : null}
        </View>

        <View style={styles.footRow}>
          {hasDetail ? (
            <Pressable
              onPress={handleToggleDetail}
              style={styles.detailsBtn}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <Text style={styles.detailsLabel}>
                {expanded
                  ? t('insights.detail_hide')
                  : t('insights.detail_show')}
              </Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {hasAction ? (
            <Pressable
              onPress={() =>
                onAction?.(insight.actionKey!, insight.actionParams ?? {})
              }
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  borderColor: triggersHexAlpha(cardColor, 0.5),
                  backgroundColor: triggersHexAlpha(
                    cardColor,
                    pressed ? 0.18 : 0.09
                  ),
                },
              ]}
            >
              <Text style={[styles.actionText, { color: cardColor }]}>
                {t(`insights.action.${insight.actionKey}`)}
              </Text>
              <ArrowUpRight size={13} color={cardColor} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: triggersSurface.radius,
    backgroundColor: triggersSurface.bg,
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stripe: {
    width: 3,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    padding: 14,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconSquare: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tag: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tagDot: {
    color: 'rgba(255,255,255,0.35)',
  },
  trendChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
  },
  detailText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  vizWrap: {
    flexShrink: 0,
  },
  footRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailsBtn: {
    paddingVertical: 2,
  },
  detailsLabel: {
    color: '#6B8BA4',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
