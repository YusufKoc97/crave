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

// Premium gating is off in Faz 2 — every test user is treated as free.
// Wired through here so Faz X (paywall) only needs to change one flag.
const IS_PREMIUM = false;

export function AddictionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  // Don't persist back to disk until the initial read finishes; the
  // first render otherwise overwrites the saved blob with an empty set.
  const hydrated = useRef(false);

  // ── Hydrate fast from AsyncStorage on mount (offline cache) ─────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE);
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setActiveIds(new Set(parsed));
          } catch {
            /* corrupt blob — start fresh */
          }
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
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchUserAddictions(user.id);
        if (cancelled) return;
        const next = new Set(
          rows.filter((r) => r.isActive).map((r) => r.addictionId)
        );
        setActiveIds(next);
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

  const limit = IS_PREMIUM ? PREMIUM_ACTIVE_LIMIT : FREE_ACTIVE_LIMIT;
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
