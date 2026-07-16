import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ADDICTION_CATALOG,
  toAddiction,
  FREE_ACTIVE_LIMIT,
  PREMIUM_ACTIVE_LIMIT,
  type Addiction,
} from '@/constants/addictions';
import { useAuth } from '@/context/AuthContext';
import {
  activateUserAddiction,
  deactivateUserAddiction,
  fetchUserAddictions,
} from '@/lib/addictionsApi';
import { useIsPremium } from '@/lib/premium';

/**
 * Faz 2 model. State = which catalog ids the user has currently
 * activated. `addictions` (the array consumers render) is derived from
 * the catalog + activeIds intersection. Non-active rows are just
 * hidden — their craving_sessions history remains, so re-adding an
 * addiction picks up right where it left off.
 */

type AddictionsContextValue = {
  /** Currently visible / trackable addictions (is_active = true). */
  addictions: Addiction[];
  /** Set of catalog ids currently active for the user. */
  activeIds: Set<string>;
  /** Free vs premium ceiling on how many can be active at once. */
  limit: number;
  /** True when a limit-reached state should block further adds. */
  atLimit: boolean;
  addAddiction: (id: string) => Promise<void>;
  removeAddiction: (id: string) => Promise<void>;
};

const AddictionsContext = createContext<AddictionsContextValue | undefined>(
  undefined
);

const STORAGE_KEY_ACTIVE = 'user_addictions_active_v1';

/** First-launch seed key. When absent, the four defaults below are
 *  activated so the home orb has something to fan out to instead
 *  of a dead empty state. Set once and never touched again — a
 *  user who intentionally removes all four should stay at zero. */
const DEFAULTS_SEEDED_KEY = 'user_addictions_defaults_seeded_v1';

/** Four broad-appeal targets: two substance (nicotine, caffeine)
 *  and two behavioural (doomscroll, junk_food). Kept short and
 *  fungible — every id lives in ADDICTION_CATALOG so no lookup
 *  can miss. */
const DEFAULT_ADDICTION_IDS: readonly string[] = [
  'nicotine',
  'caffeine',
  'doomscroll',
  'junk_food',
];

export function AddictionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isPremium = useIsPremium();
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  // Don't persist back to disk until the initial read finishes; the
  // first render otherwise overwrites the saved blob with an empty set.
  const hydrated = useRef(false);

  // ── Hydrate fast from AsyncStorage on mount (offline cache) ─────────
  //
  // Also handles the first-launch seed of DEFAULT_ADDICTION_IDS so an
  // unauthenticated preview (or a fresh device before auth completes)
  // still sees the orb picker with something in it. The seed flag
  // guards against re-seeding after an intentional zero-state — a
  // user who deletes everything stays at zero on next launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [raw, seeded] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ACTIVE),
          AsyncStorage.getItem(DEFAULTS_SEEDED_KEY),
        ]);
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setActiveIds(new Set(parsed));
          } catch {
            /* corrupt blob — start fresh */
          }
        } else if (seeded !== '1') {
          setActiveIds(new Set(DEFAULT_ADDICTION_IDS));
          await AsyncStorage.setItem(DEFAULTS_SEEDED_KEY, '1');
        }
      } finally {
        hydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Refresh from Supabase once the auth user is known ──────────────
  //
  // First-time authenticated users (no rows on the server + seed
  // flag still unset) get their defaults pushed remotely so future
  // logins on any device carry the same starting state. Best-effort
  // per id — if one fails we still show the successful ones locally.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchUserAddictions(user.id);
        if (cancelled) return;
        const seeded = await AsyncStorage.getItem(DEFAULTS_SEEDED_KEY);
        if (rows.length === 0 && seeded !== '1') {
          await Promise.all(
            DEFAULT_ADDICTION_IDS.map((id) =>
              activateUserAddiction(user.id, id).catch(() => undefined)
            )
          );
          if (cancelled) return;
          setActiveIds(new Set(DEFAULT_ADDICTION_IDS));
          await AsyncStorage.setItem(DEFAULTS_SEEDED_KEY, '1');
        } else {
          const next = new Set(
            rows.filter((r) => r.isActive).map((r) => r.addictionId)
          );
          setActiveIds(next);
        }
      } catch {
        /* keep local cache */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Mirror to AsyncStorage on every change ─────────────────────────
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(
      STORAGE_KEY_ACTIVE,
      JSON.stringify(Array.from(activeIds))
    ).catch(() => {
      /* device storage failure — surface a banner later if needed */
    });
  }, [activeIds]);

  const limit = isPremium ? PREMIUM_ACTIVE_LIMIT : FREE_ACTIVE_LIMIT;
  const atLimit = activeIds.size >= limit;

  const addAddiction = useCallback(
    async (id: string) => {
      if (activeIds.has(id)) return;
      if (activeIds.size >= limit) return; // hard guard — UI enforces earlier
      const snapshot = activeIds;
      const next = new Set(activeIds);
      next.add(id);
      setActiveIds(next);
      if (!user) return;
      try {
        await activateUserAddiction(user.id, id);
      } catch {
        setActiveIds(snapshot);
        throw new Error('Could not add. Check your connection.');
      }
    },
    [activeIds, limit, user]
  );

  const removeAddiction = useCallback(
    async (id: string) => {
      if (!activeIds.has(id)) return;
      const snapshot = activeIds;
      const next = new Set(activeIds);
      next.delete(id);
      setActiveIds(next);
      if (!user) return;
      try {
        await deactivateUserAddiction(user.id, id);
      } catch {
        setActiveIds(snapshot);
      }
    },
    [activeIds, user]
  );

  const addictions = useMemo(
    () =>
      ADDICTION_CATALOG.filter((entry) => activeIds.has(entry.id)).map(
        toAddiction
      ),
    [activeIds]
  );

  return (
    <AddictionsContext.Provider
      value={{
        addictions,
        activeIds,
        limit,
        atLimit,
        addAddiction,
        removeAddiction,
      }}
    >
      {children}
    </AddictionsContext.Provider>
  );
}

export function useAddictions() {
  const ctx = useContext(AddictionsContext);
  if (!ctx) {
    throw new Error('useAddictions must be used within AddictionsProvider');
  }
  return ctx;
}
