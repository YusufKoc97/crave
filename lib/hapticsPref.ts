import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The user's "Vibration" switch (Profile → Settings).
 *
 * A device preference, like the language: it is deliberately NOT part
 * of `purgeLocalUserState` — someone who turned haptics off doesn't
 * want them back on because a different account signed in.
 *
 * Reads are synchronous (haptics fire from tap handlers and must not
 * await), so the value is cached in memory and hydrated once from
 * AsyncStorage at import. Until hydration lands it is `true`: a
 * default-on app that lags a few ms on cold start is better than one
 * that silently drops the first haptic. Free of any react-native
 * import so it stays unit-testable.
 */

export const HAPTICS_PREF_KEY = 'crave.haptics_enabled';

let enabled = true;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

export function subscribeHaptics(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  emit();
  try {
    await AsyncStorage.setItem(HAPTICS_PREF_KEY, value ? '1' : '0');
  } catch {
    // The switch still works for this session; it just won't persist.
  }
}

/** Load the stored choice into the cache. Exported for tests. */
export async function hydrateHapticsPref(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(HAPTICS_PREF_KEY);
    if (raw === '0' || raw === '1') {
      enabled = raw === '1';
      emit();
    }
  } catch {
    // keep the default
  }
}

void hydrateHapticsPref();
