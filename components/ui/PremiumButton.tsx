import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ArrowRight } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { hexAlpha } from '@/constants/designSystem';

/**
 * THE premium call-to-action. Every "unlock / upgrade" button in the app
 * (Comparison, Triggers, Streak Map, Settings, the habit-limit banner, the
 * gold pitch card) renders this one component, so the look and the words
 * are identical everywhere — only the size changes to fit the surface.
 *
 * Gold gradient + dark label + arrow, glowing. Same gold as the paywall
 * (`app/paywall.tsx`). The label defaults to `premium.cta`; pass `label`
 * only when a surface genuinely needs different words.
 *
 * Sizes: `lg` for hero/pitch cards, `md` (default) for gates and panels,
 * `sm` for tight rows.
 */

export const PREMIUM_GOLD = '#e8c87c';
const GOLD_DEEP = '#d9b45a';
const GOLD_LIGHT = '#f6e2a6';
const INK = '#2a1f06';

type Size = 'lg' | 'md' | 'sm';

const SIZES: Record<
  Size,
  { height: number; radius: number; font: number; arrow: number; gap: number }
> = {
  lg: { height: 56, radius: 18, font: 16.5, arrow: 18, gap: 8 },
  md: { height: 46, radius: 15, font: 14.5, arrow: 16, gap: 7 },
  sm: { height: 38, radius: 13, font: 13, arrow: 15, gap: 6 },
};

type Props = {
  onPress: () => void;
  size?: Size;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function PremiumButton({
  onPress,
  size = 'md',
  label = t('premium.cta'),
  style,
}: Props) {
  const s = SIZES[size];
  // Unique gradient id per size so several buttons on one screen never
  // share/duplicate an SVG <defs> id.
  const gradId = `premiumBtn-${size}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        { height: s.height, borderRadius: s.radius, gap: s.gap },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD_LIGHT} />
            <Stop offset="1" stopColor={GOLD_DEEP} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
      </Svg>
      <Text style={[styles.label, { fontSize: s.font }]}>{label}</Text>
      <ArrowRight size={s.arrow} color={INK} strokeWidth={2.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: `0 10px 28px -8px ${hexAlpha(PREMIUM_GOLD, 0.6)}` },
      default: {
        shadowColor: PREMIUM_GOLD,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
      },
    }),
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.2,
    color: INK,
  },
});
