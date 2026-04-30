import AsyncStorage from '@react-native-async-storage/async-storage';

const ID_KEY = 'active_craving_session_id';
const SNAPSHOT_KEY = 'active_craving_snapshot';

/**
 * Lightweight snapshot of an in-flight craving so the app can resume even
 * when there's no authenticated user (e.g. DEV_MODE) and we can't fetch the
 * row from Supabase. For authenticated users we ALSO save the session id so
 * the resumed run continues to UPDATE the same DB row on finish.
 */
export type ActiveSnapshot = {
  addictionId: string;
  startedAt: number;
  /** DB row id, only present when the original INSERT succeeded. */
  sessionId?: string;
};

export async function saveActiveSessionId(id: string) {
  try {
    await AsyncStorage.setItem(ID_KEY, id);
  } catch {
    /* noop */
  }
}

export async function clearActiveSessionId() {
  try {
    await AsyncStorage.removeItem(ID_KEY);
    await AsyncStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* noop */
  }
}

export async function getActiveSessionId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ID_KEY);
  } catch {
    return null;
  }
}

export async function saveActiveSnapshot(snap: ActiveSnapshot) {
  try {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    /* noop */
  }
}

export async function getActiveSnapshot(): Promise<ActiveSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.addictionId === 'string' &&
      typeof parsed.startedAt === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
