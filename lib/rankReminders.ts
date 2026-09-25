import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Pending rank-up reminders — rank ids the user has unlocked that get
 * surfaced ONCE, as a top banner, the next time they come back to the
 * app. This is the "in case you missed it" channel that pairs with the
 * in-the-moment celebration:
 *
 *   1. The instant a rank is crossed, the active session shows the
 *      full-screen celebration (RankUnlockModal). That IS the reward.
 *   2. The same rank is also banked here. It must NOT pop a banner
 *      straight away — the user just watched the celebration, and
 *      returning to home in the same sitting would double up on it.
 *   3. Only once they have left and come back (the app was backgrounded
 *      or closed and reopened) does the home screen drain the queue and
 *      slide the reminder banner down.
 *
 * "Left and come back" is decided per entry, without persisting any
 * "last seen" clock, by two facts recorded at bank time:
 *   - `runId`: a random id minted when this JS process started. A
 *     different run id means the app was closed and cold-started since.
 *   - `at`: when it was banked. If the app has been backgrounded since
 *     (`markBackgrounded`), the entry predates that and is eligible.
 *
 * Purely local (AsyncStorage), non-PII, and deliberately free of any
 * react-native import so `purgeLocalUserState` can wipe it on sign-out
 * and it stays unit-testable. The caller (home screen) owns the
 * AppState listener and just tells us when the app went to background.
 */

export const RANK_REMINDERS_KEY = 'rank_reminders_pending_v2';

export type RankReminder = {
  id: string;
  /** JS-process id when it was banked. */
  runId: string;
  /** Epoch ms when it was banked. */
  at: number;
};

/** Minted once per JS process — a cold start gets a new one. */
const RUN_ID = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

let lastBackgroundedAt = 0;
let cache: RankReminder[] | null = null;
let hydrating: Promise<RankReminder[]> | null = null;

/**
 * Has the user left and come back since this reminder was banked?
 * Pure, so it can be tested without any storage.
 */
export function isEligible(
  reminder: RankReminder,
  runId: string,
  lastBackgroundedAtMs: number
): boolean {
  if (reminder.runId !== runId) return true; // app was cold-started
  return reminder.at <= lastBackgroundedAtMs; // backgrounded since
}

function isReminder(x: unknown): x is RankReminder {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.runId === 'string' &&
    typeof r.at === 'number'
  );
}

async function read(): Promise<RankReminder[]> {
  if (cache) return cache;
  if (!hydrating) {
    hydrating = (async () => {
      let next: RankReminder[] = [];
      try {
        const raw = await AsyncStorage.getItem(RANK_REMINDERS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) next = parsed.filter(isReminder);
      } catch {
        next = [];
      }
      cache = next;
      hydrating = null;
      return next;
    })();
  }
  return hydrating;
}

async function write(list: RankReminder[]): Promise<void> {
  cache = list;
  try {
    await AsyncStorage.setItem(RANK_REMINDERS_KEY, JSON.stringify(list));
  } catch {
    // A failed write only means the reminder won't survive a cold
    // launch — the in-moment celebration already fired, so this is a
    // nice-to-have, not a correctness path.
  }
}

/** Bank rank ids to remind about later (deduped, order kept). */
export async function addRankReminders(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const current = await read();
  const merged = [...current];
  const now = Date.now();
  for (const id of ids) {
    if (!merged.some((r) => r.id === id)) {
      merged.push({ id, runId: RUN_ID, at: now });
    }
  }
  await write(merged);
}

/** Tell us the app just went to the background (call from AppState). */
export function markBackgrounded(): void {
  lastBackgroundedAt = Date.now();
}

/**
 * Take the reminders that are due — the user has left and come back
 * since they were banked — and remove just those. Anything banked in
 * the current sitting stays queued for later.
 */
export async function drainDueRankReminders(): Promise<string[]> {
  const current = await read();
  if (current.length === 0) return [];
  const due = current.filter((r) => isEligible(r, RUN_ID, lastBackgroundedAt));
  if (due.length === 0) return [];
  await write(current.filter((r) => !due.includes(r)));
  return due.map((r) => r.id);
}

/** Wipe the queue (sign-out / account deletion). */
export async function resetRankReminders(): Promise<void> {
  cache = null;
  hydrating = null;
  try {
    await AsyncStorage.removeItem(RANK_REMINDERS_KEY);
  } catch {
    // ignore — the cache is already dropped for this session
  }
}
