import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Toolkit favorites — a small, non-PII local store of technique ids
 * the user has starred, so the carousel's "Favorites" segment can
 * surface their go-to techniques first during a craving.
 *
 * Purely local (AsyncStorage): favorites are a per-device convenience,
 * not account data, so there is no server round-trip. A module-level
 * cache + listener set keeps every mounted card and the pane in sync
 * without prop-drilling. Deliberately React-free so `purgeLocalUserState`
 * (which must stay unit-testable) can import `resetFavoritesCache`
 * without pulling React into its graph; the React hook lives in the
 * separate `useToolkitFavorites` module.
 */

const STORAGE_KEY = 'toolkit_favorites_v1';

let cache: Set<string> | null = null;
let hydrating: Promise<ReadonlySet<string>> | null = null;
const listeners = new Set<(favorites: ReadonlySet<string>) => void>();

function snapshot(): Set<string> {
  return new Set(cache ?? []);
}

function emit(): void {
  const next = snapshot();
  listeners.forEach((listener) => listener(next));
}

/** Load favorites from disk once and memoise. Safe to call repeatedly —
 *  concurrent callers share the same in-flight read. */
export async function hydrateFavorites(): Promise<ReadonlySet<string>> {
  if (cache) return cache;
  if (!hydrating) {
    hydrating = (async () => {
      let next = new Set<string>();
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          next = new Set(
            parsed.filter((x): x is string => typeof x === 'string')
          );
        }
      } catch {
        // Corrupt or unreadable blob — start from an empty set rather
        // than wedging the toolkit. The next toggle rewrites it clean.
        next = new Set();
      }
      cache = next;
      hydrating = null;
      emit();
      return cache;
    })();
  }
  return hydrating;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...(cache ?? [])]));
  } catch {
    // Best-effort — the in-memory cache already reflects the toggle, so
    // the UI is correct for this session even if the write fails.
  }
}

export async function toggleFavorite(id: string): Promise<void> {
  await hydrateFavorites();
  if (!cache) cache = new Set();
  if (cache.has(id)) cache.delete(id);
  else cache.add(id);
  emit();
  await persist();
}

export function getFavoritesSnapshot(): ReadonlySet<string> {
  return snapshot();
}

export function subscribeFavorites(
  listener: (favorites: ReadonlySet<string>) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Sign-out / account-deletion hook: wipe both the in-memory cache and
 * the persisted key so the next user on a shared device does not
 * inherit the previous one's starred techniques.
 */
export async function resetFavoritesCache(): Promise<void> {
  cache = new Set();
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal; the in-memory reset is the user-visible part.
  }
}
