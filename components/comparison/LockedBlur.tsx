import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Teaser blur laid over ONE locked card (Free tier). Deliberately light:
 * the card's silhouette — bell curve, bars, clock ring — must still read
 * so the user sees what Premium unlocks. Rounded to the card's own radius
 * so it hugs the card instead of smearing into one slab.
 *
 * Native only: `filter: blur` is web-only in RN, so web keeps blurring
 * through FreeGate's CSS filter instead.
 */
export const CARD_RADIUS = 20;

export function LockedBlur({
  intensity = 16,
  radius = CARD_RADIUS,
}: {
  intensity?: number;
  /** Match the host card's corner radius (Standing is 24, the rest 20). */
  radius?: number;
}) {
  if (Platform.OS === 'web') return null;
  return (
    <BlurView
      pointerEvents="none"
      intensity={intensity}
      tint="dark"
      style={[styles.fill, { borderRadius: radius }]}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
});
