import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearActiveSessionId, clearPendingFinish } from './activeSession';
import { resetOnboarding } from './onboarding';

/**
 * Local-state purge shared by sign-out and account deletion.
 *
 * Every AsyncStorage key this app writes is a global literal with no
 * user id in it, so on a shared device the next user inherits the
 * previous one's tracked addictions, in-flight craving and cached
 * heatmaps unless they are wiped on the way out. This is the single
 * place that wipes them.
 *
 * Deliberately imports NOTHING from `./supabase` (or any React /
 * react-native module) so it stays unit-testable under Vitest's
 * "pure logic only" scope. It owns the two addiction key strings —
 * `AddictionsContext` imports them from here rather than the other
 * way round — precisely to keep that import graph clean.
 */

/** Catalog ids the user has activated (context/AddictionsContext). */
export const ADDICTIONS_ACTIVE_KEY = 'user_addictions_active_v1';

/** First-launch seed flag. MUST be cleared alongside the active key —
 *  leaving it set makes the next account fall through to an empty
 *  Set with no defaults, i.e. a dead home orb. */
export const ADDICTIONS_SEEDED_KEY = 'user_addictions_defaults_seeded_v1';

/** supabase-js persists its session under `sb-<project>-auth-token`
 *  (+ `-code-verifier`, `-user`). We derive nothing from the URL here;
 *  a prefix sweep removes all three without hardcoding the project ref. */
const SUPABASE_KEY_PREFIX = 'sb-';

export async function purgeLocalUserState({
  includeOnboarding,
}: {
  /** Onboarding keys hold a KVKK consent record and a date of birth.
   *  Clear them ONLY on account deletion (the erasing user's PII must
   *  go); never on ordinary sign-out, where clearing them would route
   *  the next launch past the consent gate. */
  includeOnboarding: boolean;
}): Promise<void> {
  // Craving-flow blobs first — an unpurged snapshot replays the
  // previous user's craving into whoever signs in next, and the
  // Edge Function attributes it to the presented JWT, not the payload.
  await clearActiveSessionId(); // id + snapshot
  await clearPendingFinish(); // pending resolve

  await AsyncStorage.multiRemove([
    ADDICTIONS_ACTIVE_KEY,
    ADDICTIONS_SEEDED_KEY,
  ]);

  if (includeOnboarding) await resetOnboarding();

  // Defensive last step: sweep the supabase-js session keys. On a
  // clean sign-out these are already gone; this catches the delete
  // path (where signOut may have failed against a now-deleted user)
  // and any half-written auth state.
  try {
    const keys = await AsyncStorage.getAllKeys();
    const sbKeys = keys.filter((k) => k.startsWith(SUPABASE_KEY_PREFIX));
    if (sbKeys.length > 0) await AsyncStorage.multiRemove(sbKeys);
  } catch (e) {
    // Non-fatal — the explicit signOut path is the primary token
    // clear; this sweep is belt-and-braces. Log so a persistently
    // failing storage layer is diagnosable.
    console.warn('purgeLocalUserState: sb-* sweep failed', e);
  }
}
