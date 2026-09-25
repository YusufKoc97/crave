import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HAPTICS_PREF_KEY,
  hydrateHapticsPref,
  isHapticsEnabled,
  setHapticsEnabled,
  subscribeHaptics,
} from '@/lib/hapticsPref';

describe('haptics preference', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(HAPTICS_PREF_KEY);
    await setHapticsEnabled(true);
  });

  it('defaults to on', () => {
    expect(isHapticsEnabled()).toBe(true);
  });

  it('persists the choice and applies it immediately', async () => {
    await setHapticsEnabled(false);
    expect(isHapticsEnabled()).toBe(false);
    expect(await AsyncStorage.getItem(HAPTICS_PREF_KEY)).toBe('0');
  });

  it('notifies subscribers, and stops after unsubscribe', async () => {
    const fn = vi.fn();
    const off = subscribeHaptics(fn);
    await setHapticsEnabled(false);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    await setHapticsEnabled(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('hydrates a stored "off" on the next launch', async () => {
    await AsyncStorage.setItem(HAPTICS_PREF_KEY, '0');
    await hydrateHapticsPref();
    expect(isHapticsEnabled()).toBe(false);
  });

  it('ignores a garbage stored value', async () => {
    await AsyncStorage.setItem(HAPTICS_PREF_KEY, 'banana');
    await hydrateHapticsPref();
    expect(isHapticsEnabled()).toBe(true);
  });
});
