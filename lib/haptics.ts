import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Thin wrapper around expo-haptics. Three semantic moments matter in
 * CRAVE:
 *
 *   tap()      — light tick on regular taps (resist button, picker
 *                tiles, tab switches)
 *   commit()   — medium impact on a real decision (I Resisted /
 *                I gave in / Add Craving submit)
 *   celebrate() — success notification on a cycle completion or share
 *
 * All three are no-ops on web; expo-haptics throws there.
 *
 * The functions are non-async by design — fire-and-forget. If the
 * device hates the request we don't care; haptics is a nice-to-have,
 * not a primary feedback channel.
 */

const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

export function hapticTap() {
  if (!isMobile) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticCommit() {
  if (!isMobile) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticCelebrate() {
  if (!isMobile) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {}
  );
}

export function hapticWarn() {
  if (!isMobile) return;
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
  if (!isMobile) return;
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
