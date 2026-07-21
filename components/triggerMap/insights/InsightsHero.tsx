import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import type { TriggerMapInsight } from '@/lib/triggerMap';
import {
  triggersAccent,
  triggersAccentAlpha,
  triggersSurface,
} from '../triggersTheme';
import { buildInsightPresentation } from './heroData';
import { RadialRing } from './RadialRing';

// Android LayoutAnimation opt-in.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Personal Insights hero (Modül 3 redesign).
 *
 * Sits at the top of the insight stack. Renders the highest-priority
 * insight as a "glass card with a violet aura" — kicker (icon +
 * CATEGORY · SUBLABEL), big numeric value, description, right-side
 * radial % ring. A "Details" toggle flips a chevron and reveals the
 * `detailKey` body (LayoutAnimation to keep the reveal buttery).
 *
 * The card owns nothing addiction-specific — it's violet across the
 * board (see triggersTheme). If the insight has an action key
 * (e.g. `open_toolkit`) the parent surfaces that separately below;
 * hero deliberately stays action-free to keep the visual focus on
 * the value.
 */

type Props = {
  insight: TriggerMapInsight;
  addictionId: string;
  expanded: boolean;
  onToggle: () => void;
};

export function InsightsHero({
  insight,
  addictionId,
  expanded,
  onToggle,
}: Props) {
  const p = buildInsightPresentation(insight, addictionId);
  const hasDetail = !!insight.detailKey;
  const detailText = insight.detailKey
    ? t(insight.detailKey, p.resolvedInterpolation)
    : '';

  const handleToggleDetail = () => {
    if (!hasDetail) return;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(200, 'easeInEaseOut', 'opacity')
    );
    onToggle();
  };

  return (
    <View style={styles.card}>
      {/* Subtle violet aura layered onto the card via border + glow. */}
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.kickerWrap}>
            <View style={styles.iconWrap}>
              <Clock size={12} color={triggersAccent} strokeWidth={2.4} />
            </View>
            <Text style={styles.kicker}>
              {p.categoryLabel}
              <Text style={styles.kickerDot}> · </Text>
              {p.sublabel}
            </Text>
          </View>
        </View>

        <View style={styles.mainRow}>
          <View style={styles.leftCol}>
            {p.bigValue ? (
              <Text style={styles.bigValue} numberOfLines={1}>
                {p.bigValue}
              </Text>
            ) : null}
            <Text style={styles.description} numberOfLines={3}>
              {p.description}
            </Text>
          </View>
          <RadialRing percent={p.ringPct} size={78} stroke={6}>
            <Text style={styles.ringLabel}>{Math.round(p.ringPct)}%</Text>
          </RadialRing>
        </View>

        {hasDetail ? (
          <Pressable
            onPress={handleToggleDetail}
            style={({ pressed }) => [
              styles.detailsToggle,
              pressed && { backgroundColor: triggersAccentAlpha(0.08) },
            ]}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
          >
            <Text style={styles.detailsLabel}>
              {t('insights.details_toggle')}
            </Text>
            {expanded ? (
              <ChevronUp size={14} color={triggersAccent} strokeWidth={2.4} />
            ) : (
              <ChevronDown size={14} color={triggersAccent} strokeWidth={2.4} />
            )}
          </Pressable>
        ) : null}

        {hasDetail && expanded ? (
          <Text style={styles.detailText}>{detailText}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: triggersSurface.radius,
    // Slightly more opaque than the shared token so the aurora +
    // parent AmbientGlow don't wash out the hero copy.
    backgroundColor: '#131F3A',
    borderWidth: 1,
    borderColor: triggersAccentAlpha(0.42),
    marginBottom: 14,
    overflow: 'hidden',
    // Web-only soft violet glow (RN native ignores boxShadow prior to 0.76,
    // but Expo SDK 54 supports it natively too).
    ...Platform.select({
      web: {
        boxShadow: `0 12px 40px ${triggersAccentAlpha(0.22)}`,
      },
      default: {
        shadowColor: triggersAccent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 6,
      },
    }),
  },
  body: {
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  kickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: triggersAccentAlpha(0.14),
    borderWidth: 1,
    borderColor: triggersAccentAlpha(0.35),
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: triggersAccent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  kickerDot: {
    color: triggersAccentAlpha(0.55),
    fontWeight: '700',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  leftCol: {
    flex: 1,
    minWidth: 0,
  },
  bigValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  description: {
    color: '#D9E1F2',
    fontSize: 13,
    lineHeight: 18,
  },
  ringLabel: {
    color: triggersAccent,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  detailsToggle: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: triggersAccentAlpha(0.35),
  },
  detailsLabel: {
    color: triggersAccent,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  detailText: {
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 10,
  },
});
