import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { isHapticsEnabled } from './hapticsPref';

/**
 * Thin wrapper around expo-haptics. Haptics in CRAVE are rationed on
 * purpose — a buzz means "something meaningful just happened", never
 * "you touched a thing". The moments that earn one:
 *
 *   start()    — a craving begins (picked an addiction on home)
 *   resist()   — the single, weightiest tap: "I Resisted"
 *   celebrate() / rankPeak() — a rank is unlocked (peak for the rare ones)
 *   tap()      — a light tick when a technique card is chosen
 *
 * (`warn` marks the two "that didn't go through" moments: unticked
 * consent and hitting the addiction limit; `celebrate` also closes
 * onboarding.)
 *
 * Every helper is a no-op on web (expo-haptics throws there) and when
 * the user has switched Vibration off in Settings. They are non-async
 * by design — fire-and-forget; haptics is a nice-to-have, never a
 * primary feedback channel.
 */

const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

/** Single gate: right platform AND the user hasn't turned it off. */
const canBuzz = () => isMobile && isHapticsEnabled();

export function hapticTap() {
  if (!canBuzz()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A craving begins — a steady medium impact ("I'm with you"). */
export function hapticStart() {
  if (!canBuzz()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** "I Resisted" — one heavier, fuller hit; the win of the whole flow. */
export function hapticResist() {
  if (!canBuzz()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function hapticCelebrate() {
  if (!canBuzz()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {}
  );
}

export function hapticWarn() {
  if (!canBuzz()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => {}
  );
}

/**
 * Peak-rank celebration — a short crescendo (two heavy impacts into a
 * success chime) reserved for the milestone ranks (Master, Expert,
 * Free). Deliberately heavier than `celebrate()` so the rare ranks
 * feel physically bigger than the frequent early ones.
 */
export function hapticRankPeak() {
  if (!canBuzz()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  setTimeout(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, 130);
  setTimeout(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
  }, 320);
}
