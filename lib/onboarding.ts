import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'onboarding_completed';
const DOB_KEY = 'onboarding_dob';
const CONSENT_KEY = 'onboarding_consent_signed_at';

export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function markOnboardingCompleted(opts: {
  dob: string; // ISO date "YYYY-MM-DD"
  consentSignedAt: string; // ISO timestamp
}) {
  try {
    await AsyncStorage.multiSet([
      [KEY, 'true'],
      [DOB_KEY, opts.dob],
      [CONSENT_KEY, opts.consentSignedAt],
    ]);
  } catch {
    /* noop */
  }
}

export async function resetOnboarding() {
  try {
    await AsyncStorage.multiRemove([KEY, DOB_KEY, CONSENT_KEY]);
  } catch {
    /* noop */
  }
}

/** Years between `dob` and now. Returns -1 for invalid dates. */
export function calculateAge(year: number, month: number, day: number): number {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return -1;
  }
  if (year < 1900 || year > 2100) return -1;
  if (month < 1 || month > 12) return -1;
  if (day < 1 || day > 31) return -1;
  // Reject impossible day/month combinations.
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return -1;

  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1;
  if (m < month || (m === month && today.getDate() < day)) age -= 1;
  return age;
}
