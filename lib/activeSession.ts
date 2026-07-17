import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Faz 5 REVERSAL — client-only pending state.
 *
 * Since the switch to post-resolve trigger capture, we no longer
 * INSERT a `craving_sessions` row on timer mount. The client
 * generates a UUID at start, holds it locally, and passes it as
 * the `session_id` to `resolve-craving` which does the atomic
 * INSERT (row goes straight from nonexistent → resolved).
 *
 * That means the ONLY source of "you have a session in flight" on
 * cold launch is the AsyncStorage snapshot below. No server query
 * needed — the ActiveSessionRestorer just replays the snapshot.
 *
 * Consequence for Faz 7 (presence counter): with no `active` rows,
 * the active-presence Edge Function will always count 0 for
 * mid-flight users. Accepted trade-off; a heartbeat table is the
 * next step if we need presence back.
 */

const ID_KEY = 'active_craving_session_id';
const SNAPSHOT_KEY = 'active_craving_snapshot_v2';
// v3 payload: client-authored full resolve, matching the atomic
// INSERT Edge Function schema. Older v2 blobs are silently
// ignored — a replay of a blob from before the reversal would
// crash on the missing session row.
const PENDING_FINISH_KEY = 'pending_finish_v3';

/**
 * Lightweight snapshot of an in-flight craving so the app can
 * resume even when there's no network. Includes the client-side
 * session UUID that the resolve will use as PK.
 */
export type ActiveSnapshot = {
  addictionId: string;
  startedAt: number;
  /** Client-generated UUID used as craving_sessions.id on resolve. */
  sessionId: string;
  /** Copy of sensitivity so the resolve payload doesn't need to
   *  re-look up the catalog on cold restart. */
  sensitivity: number;
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
      typeof parsed.startedAt === 'number' &&
      typeof parsed.sessionId === 'string' &&
      typeof parsed.sensitivity === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Pending finish blob. Written the moment `resolve-craving` is
 * invoked so a mid-flight network drop is replayable on next
 * cold launch. Includes everything the atomic INSERT needs.
 *
 * The Edge Function keys idempotency off `session_id` (the
 * client-generated UUID also stored in the snapshot) — a replay
 * of the same UUID hits the PK conflict and returns the previously
 * computed response.
 */
export type PendingFinish = {
  sessionId: string;
  payload: {
    addictionId: string;
    startedAt: string; // ISO
    endedAt: string; // ISO
    sensitivity: number;
    outcome: 'resisted' | 'failed';
    intensity: number | null;
    triggerIds: string[];
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
    const p = parsed?.payload;
    if (
      parsed &&
      typeof parsed.sessionId === 'string' &&
      p &&
      typeof p.addictionId === 'string' &&
      typeof p.startedAt === 'string' &&
      typeof p.endedAt === 'string' &&
      typeof p.sensitivity === 'number' &&
      (p.outcome === 'resisted' || p.outcome === 'failed') &&
      (p.intensity === null || typeof p.intensity === 'number') &&
      Array.isArray(p.triggerIds) &&
      p.triggerIds.every((id: unknown) => typeof id === 'string')
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
