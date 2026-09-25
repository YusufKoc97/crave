import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Pending rank-up reminders — rank ids the user has unlocked that
 * should be surfaced once, as a top banner, the NEXT time the app is
 * opened. This is the "in case you missed it" channel that pairs with
 * the in-the-moment celebration modal:
 *
 *   - The active session shows the full-screen celebration the instant
 *     a rank is crossed (RankUnlockModal).
 *   - It ALSO records the rank id here. On the next launch the home
 *     screen drains this queue and slides a reminder banner down from
 *     the top, then clears it — so a rank crossed while the user was
 *     glancing away (or that they dismissed quickly) still lands once.
 *
 * Purely local (AsyncStorage), non-PII, React-free so
 * `purgeLocalUserState` can wipe it on sign-out without pulling React
 * into its graph. Same shape as `toolkitFavorites`: a module-level
 * cache + a hydrate-once read.
 */

export const RANK_REMINDERS_KEY = 'rank_reminders_pending_v1';

let cache: string[] | null = null;
let hydrating: Promise<string[]> | null = null;

async function read(): Promise<string[]> {
  if (cache) return cache;
  if (!hydrating) {
    hydrating = (async () => {
      let next: string[] = [];
      try {
        const raw = await AsyncStorage.getItem(RANK_REMINDERS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          next = parsed.filter((x): x is string => typeof x === 'string');
        }
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

async function write(ids: string[]): Promise<void> {
  cache = ids;
  try {
    await AsyncStorage.setItem(RANK_REMINDERS_KEY, JSON.stringify(ids));
  } catch {
    // A failed write just means the reminder won't survive a cold
    // launch — the in-moment celebration already fired, so this is a
    // nice-to-have, not a correctness path.
  }
}

/** Queue rank ids to remind about on next launch (deduped, order kept). */
export async function addRankReminders(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const current = await read();
  const merged = [...current];
  for (const id of ids) if (!merged.includes(id)) merged.push(id);
  await write(merged);
}

/** Read the pending reminders WITHOUT clearing them. */
export async function peekRankReminders(): Promise<string[]> {
  return [...(await read())];
}

/** Read and clear the pending reminders in one shot. */
export async function drainRankReminders(): Promise<string[]> {
  const current = await read();
  if (current.length === 0) return [];
  await write([]);
  return [...current];
}

/** Wipe the queue (sign-out / account deletion). */
export async function resetRankReminders(): Promise<void> {
  cache = [];
  try {
    await AsyncStorage.removeItem(RANK_REMINDERS_KEY);
  } catch {
    // ignore — cache is already cleared for this session
  }
}
