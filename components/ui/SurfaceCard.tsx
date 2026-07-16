import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { dsColors, dsRadius } from '@/constants/designSystem';

/**
 * Design-system card primitive.
 *
 * Deliberately separate from `components/Card.tsx` — the legacy Card
 * ships to the home screen, add-addiction picker, and onboarding
 * flows on the old theme.ts palette. Retrofitting those all at once
 * would blow up the polish-phase scope, so this primitive lives
 * alongside and only newly-touched screens consume it.
 *
 * Two variants:
 *   - `default`   88pt-ish surface, `dsColors.cardSurface` bg
 *   - `elevated`  same bg + a soft outer shadow (used for hero
 *                 cards where atmosphere sits behind the card)
 */

type Props = ViewProps & {
  variant?: 'default' | 'elevated';
  /** Override the corner radius. Defaults to design-system `card`. */
  radius?: number;
  /** Override the padding. Defaults to no padding — callers control it. */
  padding?: number;
};

export function SurfaceCard({
  variant = 'default',
  radius = dsRadius.card,
  padding,
  style,
  children,
  ...rest
}: Props) {
  const composed: ViewStyle = {
    borderRadius: radius,
    ...(padding !== undefined ? { padding } : null),
  };
  return (
    <View
      {...rest}
      style={[
        styles.base,
        variant === 'elevated' ? styles.elevated : null,
        composed,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: dsColors.cardSurface,
    borderColor: dsColors.borderSubtle,
    borderWidth: 1,
    overflow: 'hidden',
  },
  elevated: {
    borderColor: dsColors.borderAccent,
    // Native reads shadow*, web reads boxShadow (RN Web polyfills).
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
});
