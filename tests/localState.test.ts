import { describe, it, expect, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  purgeLocalUserState,
  ADDICTIONS_ACTIVE_KEY,
  ADDICTIONS_SEEDED_KEY,
} from '@/lib/localState';

/**
 * The purge is the one thing standing between "user A signed out" and
 * "user B sees user A's data on a shared device". These tests pin the
 * exact keys it removes and — just as important — the ones it must
 * leave alone on an ordinary sign-out (the KVKK onboarding record).
 */

// Every app-authored key plus the supabase-js session trio, seeded so
// we can assert precisely what survives.
const APP_KEYS = [
  ADDICTIONS_ACTIVE_KEY,
  ADDICTIONS_SEEDED_KEY,
  'active_craving_session_id',
  'active_craving_snapshot_v2',
  'pending_finish_v3',
];
const ONBOARDING_KEYS = [
  'onboarding_completed',
  'onboarding_dob',
  'onboarding_consent_signed_at',
];
const SUPABASE_KEYS = [
  'sb-scdedlhpbcddoqphauxo-auth-token',
  'sb-scdedlhpbcddoqphauxo-auth-token-code-verifier',
  'sb-scdedlhpbcddoqphauxo-auth-token-user',
];

async function seedEverything() {
  await AsyncStorage.multiSet(
    [...APP_KEYS, ...ONBOARDING_KEYS, ...SUPABASE_KEYS].map((k) => [k, 'x'])
  );
}

async function remaining(): Promise<Set<string>> {
  return new Set(await AsyncStorage.getAllKeys());
}

describe('purgeLocalUserState', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('sign-out purge removes app + supabase keys but keeps onboarding', async () => {
    await seedEverything();
    await purgeLocalUserState({ includeOnboarding: false });

    const left = await remaining();
    for (const k of [...APP_KEYS, ...SUPABASE_KEYS]) {
      expect(left.has(k), `${k} should be purged`).toBe(false);
    }
    // KVKK consent + DOB must survive an ordinary sign-out — clearing
    // them would route the next launch past the consent gate.
    for (const k of ONBOARDING_KEYS) {
      expect(left.has(k), `${k} should survive sign-out`).toBe(true);
    }
  });

  it('delete purge removes onboarding keys too', async () => {
    await seedEverything();
    await purgeLocalUserState({ includeOnboarding: true });

    const left = await remaining();
    for (const k of [...APP_KEYS, ...ONBOARDING_KEYS, ...SUPABASE_KEYS]) {
      expect(left.has(k), `${k} should be purged`).toBe(false);
    }
  });

  it('leaves unrelated keys untouched', async () => {
    await AsyncStorage.setItem('some_other_pref', 'keep');
    await seedEverything();
    await purgeLocalUserState({ includeOnboarding: true });

    expect(await AsyncStorage.getItem('some_other_pref')).toBe('keep');
  });

  it('is a no-op-safe on an already-clean store', async () => {
    await expect(
      purgeLocalUserState({ includeOnboarding: true })
    ).resolves.toBeUndefined();
    expect((await remaining()).size).toBe(0);
  });
});
