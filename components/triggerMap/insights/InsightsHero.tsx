import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import type { TriggerMapInsight } from '@/lib/triggerMap';
import { triggersSurface } from '../triggersTheme';
import { useTriggersAccent } from '../triggersAccent';
import {
  CardAura,
  CountUpText,
  TRIG_MOTION,
  useCardEntrance,
} from '../triggersMotion';
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
 * insight as a glass card with an accent aura — kicker (icon +
 * CATEGORY · SUBLABEL), big numeric value, description, right-side
 * radial % ring. A "Details" toggle flips a chevron and reveals the
 * `detailKey` body (LayoutAnimation to keep the reveal buttery).
 *
 * Accent follows the open addiction (see `triggersAccent.tsx`), so
 * this card is gold on Smoking and teal on Alcohol — matching the
 * sibling Comparison tab instead of forcing violet everywhere.
 *
 * If the insight has an action key (e.g. `open_toolkit`) the parent
 * surfaces that separately below; hero deliberately stays action-free
 * to keep the visual focus on the value.
 */

type Props = {
  insight: TriggerMapInsight;
  addictionId: string;
  expanded: boolean;
  onToggle: () => void;
  /** Position in the insight stack — drives the entrance stagger. */
  index?: number;
};

export function InsightsHero({
  insight,
  addictionId,
  expanded,
  onToggle,
  index = 0,
}: Props) {
  const { accent, alpha } = useTriggersAccent();
  const entrance = useCardEntrance(index);
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
    <Animated.View
      style={[
        styles.card,
        {
          borderColor: alpha(0.42),
          ...Platform.select({
            web: { boxShadow: `0 12px 40px ${alpha(0.22)}` },
            default: { shadowColor: accent },
          }),
        },
        entrance,
      ]}
    >
      {/* Accent aura — the addiction's colour blooming from the top
          corner, same device Comparison's StandingCard uses. */}
      <CardAura intensity={0.2} size={210} />
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.kickerWrap}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: alpha(0.14),
                  borderColor: alpha(0.35),
                },
              ]}
            >
              <Clock size={12} color={accent} strokeWidth={2.4} />
            </View>
            <Text style={[styles.kicker, { color: accent }]}>
              {p.categoryLabel}
              <Text style={[styles.kickerDot, { color: alpha(0.55) }]}>
                {' '}
                ·{' '}
              </Text>
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
            {/* Counts up in step with the arc drawing itself. */}
            <CountUpText
              value={Math.round(p.ringPct)}
              delay={index * TRIG_MOTION.cardStaggerMs}
              suffix="%"
              style={[styles.ringLabel, { color: accent }]}
            />
          </RadialRing>
        </View>

        {hasDetail ? (
          <Pressable
            onPress={handleToggleDetail}
            style={({ pressed }) => [
              styles.detailsToggle,
              { borderColor: alpha(0.35) },
              pressed && { backgroundColor: alpha(0.08) },
            ]}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
          >
            <Text style={[styles.detailsLabel, { color: accent }]}>
              {t('insights.details_toggle')}
            </Text>
            {expanded ? (
              <ChevronUp size={14} color={accent} strokeWidth={2.4} />
            ) : (
              <ChevronDown size={14} color={accent} strokeWidth={2.4} />
            )}
          </Pressable>
        ) : null}

        {hasDetail && expanded ? (
          <Text style={styles.detailText}>{detailText}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: triggersSurface.radius,
    // Slightly more opaque than the shared token so the aurora +
    // parent AmbientGlow don't wash out the hero copy.
    backgroundColor: '#131F3A',
    borderWidth: 1,
    marginBottom: 14,
    // Clips the CardAura bloom to the card's rounded corners.
    overflow: 'hidden',
    // Colour half of the glow is applied inline (it depends on the
    // addiction accent); only the geometry lives here.
    ...Platform.select({
      web: {},
      default: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 6,
      },
    }),
  },
  // Sits above the absolutely-positioned CardAura. On web an absolute
  // sibling paints over in-flow content regardless of DOM order, so
  // the body needs its own positioned layer.
  body: {
    padding: 18,
    position: 'relative',
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  kickerDot: {
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
  },
  detailsLabel: {
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
