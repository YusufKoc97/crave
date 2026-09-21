import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Teaser blur laid over ONE locked card (Free tier). The card's silhouette
 * — bell curve, bars, clock ring — should still read so the user sees what
 * Premium unlocks, while its text and numbers don't. Rounded to the card's
 * own radius so it hugs the card instead of smearing into one slab.
 *
 * Per platform (chosen so neither can misbehave):
 *   • iOS     — real `BlurView` (expo-blur; solid on iOS and Expo Go).
 *   • Android — a plain frosted-glass tint (translucent navy View). NOT
 *               BlurView: on Android SDK 54 it only blurs through an
 *               experimental path, and without it renders as a bare tint
 *               anyway, so we skip the native module there entirely.
 *   • Web     — nothing here; callers blur with CSS `filter: blur`.
 *
 * `intensity` (roughly 8–40) means "how hidden": it is the blur strength on
 * iOS and the tint opacity on Android.
 */
export const CARD_RADIUS = 20;

// Card surface navy, so the frost reads as the card itself going matte.
const FROST_RGB = '14, 21, 38';

function frostAlpha(intensity: number): number {
  return Math.min(0.95, 0.78 + intensity * 0.005);
}

export function LockedBlur({
  intensity = 16,
  radius = CARD_RADIUS,
}: {
  intensity?: number;
  /** Match the host card's corner radius (Standing is 24, the rest 20). */
  radius?: number;
}) {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.fill,
          {
            borderRadius: radius,
            backgroundColor: `rgba(${FROST_RGB}, ${frostAlpha(intensity)})`,
          },
        ]}
      />
    );
  }

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
