import AsyncStorage from '@react-native-async-storage/async-storage';

const ID_KEY = 'active_craving_session_id';
const SNAPSHOT_KEY = 'active_craving_snapshot';
const PENDING_FINISH_KEY = 'pending_finish_v1';

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

/**
 * The UPDATE that finalises a craving_sessions row to status='completed'
 * is fire-and-forget — if the network drops between the user tapping "I
 * Resisted" and the request hitting Supabase, the row stays stuck at
 * 'active' forever and the row's PARTIAL UNIQUE INDEX (user_id where
 * status='active') blocks the next session.
 *
 * We stash the finish payload locally the moment we kick off the call,
 * clear it on success, and ActiveSessionRestorer replays whatever's
 * left on the next cold launch.
 */
export type PendingFinish = {
  sessionId: string;
  payload: {
    status: 'completed';
    outcome: 'resisted' | 'gave_in';
    ended_at: string;
    duration_seconds: number;
    points_earned: number;
    completed_cycles: number;
  };
};

export async function savePendingFinish(p: PendingFinish) {
  try {
    await AsyncStorage.setItem(PENDING_FINISH_KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

export async function getPendingFinish(): Promise<PendingFinish | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_FINISH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.sessionId === 'string' &&
      parsed.payload &&
      parsed.payload.status === 'completed' &&
      (parsed.payload.outcome === 'resisted' ||
        parsed.payload.outcome === 'gave_in') &&
      typeof parsed.payload.ended_at === 'string' &&
      typeof parsed.payload.duration_seconds === 'number' &&
      typeof parsed.payload.points_earned === 'number' &&
      typeof parsed.payload.completed_cycles === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearPendingFinish() {
  try {
    await AsyncStorage.removeItem(PENDING_FINISH_KEY);
  } catch {
    /* noop */
  }
}
