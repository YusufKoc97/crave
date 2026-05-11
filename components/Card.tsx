import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { surfaces } from '@/constants/theme';

/**
 * Single-purpose card wrapper. Adds two things to a regular <View>:
 *   1. a 1px alpha-white inner highlight pinned to the top edge —
 *      tricks the eye into reading the surface as "lit from above"
 *      without breaking the flat dark aesthetic;
 *   2. optional outer shadow (variant="elevated") for cards that
 *      should feel one layer above the canvas (stat blocks, share
 *      banner, post cards).
 *
 * Border + background come from constants/theme.surfaces so the
 * 40+ inline `borderColor: '#1A2840'` call sites can migrate piece
 * by piece without breaking visual consistency.
 *
 * Usage:
 *   <Card style={styles.statCard} variant="elevated">
 *     ...
 *   </Card>
 */
export function Card({
  children,
  style,
  variant = 'base',
  showHighlight = true,
  borderRadius = 14,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'base' | 'soft' | 'elevated';
  /** Disable the 1px top highlight (useful inside chips / pills). */
  showHighlight?: boolean;
  /** Cards with custom radii need to clip the highlight; pass it
   *  here so the absolute child gets the matching topLeftRadius +
   *  topRightRadius. */
  borderRadius?: number;
}) {
  const surface =
    variant === 'soft'
      ? surfaces.cardSoft
      : variant === 'elevated'
        ? surfaces.cardElevated
        : surfaces.card;
  return (
    <View
      style={[
        surface,
        { borderRadius, overflow: 'hidden' },
        // Web shadow: re-derive boxShadow because RN-Web ignores
        // shadow{Color,Offset,Opacity,Radius} when present alongside
        // borderWidth. Native uses the shadow* fields above.
        variant === 'elevated' ? styles.elevatedWebShadow : null,
        style,
      ]}
    >
      {children}
      {showHighlight && (
        <View
          pointerEvents="none"
          style={[
            surfaces.innerHighlight,
            {
              borderTopLeftRadius: borderRadius,
              borderTopRightRadius: borderRadius,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  elevatedWebShadow: {
    // RN-Web reads `boxShadow` only; native ignores it.
    // 0 px X, 6 px Y, 14 px blur, 0 spread, near-black at 0.45 alpha.
    boxShadow: '0px 6px 14px rgba(0, 0, 0, 0.45)',
  },
});
