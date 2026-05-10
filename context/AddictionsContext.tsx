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
import { DEFAULT_ADDICTIONS, type Addiction } from '@/constants/addictions';
import { useAuth } from '@/context/AuthContext';
import {
  createAddiction,
  deleteAddictionRow,
  fetchCustomAddictions,
  fetchHiddenDefaults,
  persistHiddenDefaults,
  updateAddictionRow,
} from '@/lib/addictionsApi';

type NewAddictionInput = {
  name: string;
  emoji: string;
  color: string;
  sensitivity: number;
};

type AddictionPatch = Partial<NewAddictionInput>;

type AddictionsContextValue = {
  addictions: Addiction[];
  addAddiction: (input: NewAddictionInput) => Promise<Addiction>;
  removeAddiction: (id: string) => Promise<void>;
  /**
   * Update fields on an existing custom addiction. Updates on default
   * (preset) addictions are a no-op — defaults are intentionally
   * read-only so the community filters and seed icons stay stable.
   */
  updateAddiction: (id: string, patch: AddictionPatch) => Promise<void>;
};

const AddictionsContext = createContext<AddictionsContextValue | undefined>(undefined);

const STORAGE_KEY_CUSTOM = 'addictions_custom_v1';
const STORAGE_KEY_HIDDEN = 'addictions_hidden_defaults_v1';

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function AddictionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [custom, setCustom] = useState<Addiction[]>([]);
  const [hiddenDefaults, setHiddenDefaults] = useState<Set<string>>(new Set());
  // Don't persist back to disk until we've finished the initial read,
  // otherwise the effect runs once with empty state and overwrites the
  // saved blob.
  const hydrated = useRef(false);

  // ── Hydrate fast from AsyncStorage on mount (offline cache) ─────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [customRaw, hiddenRaw] = await AsyncStorage.multiGet([
          STORAGE_KEY_CUSTOM,
          STORAGE_KEY_HIDDEN,
        ]);
        if (cancelled) return;
        if (customRaw[1]) {
          try {
            const parsed = JSON.parse(customRaw[1]);
            if (Array.isArray(parsed)) setCustom(parsed);
          } catch {
            /* corrupt blob — start fresh */
          }
        }
        if (hiddenRaw[1]) {
          try {
            const parsed = JSON.parse(hiddenRaw[1]);
            if (Array.isArray(parsed)) setHiddenDefaults(new Set(parsed));
          } catch {
            /* same */
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

  // ── Refresh from Supabase whenever the auth user becomes known ─────
  // The local cache from AsyncStorage already painted the UI; the server
  // pull replaces it once the network responds. If the call fails we
  // keep the cached values rather than blanking the screen.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [serverCustom, serverHidden] = await Promise.all([
          fetchCustomAddictions(user.id),
          fetchHiddenDefaults(user.id),
        ]);
        if (cancelled) return;
        setCustom(serverCustom);
        setHiddenDefaults(serverHidden);
      } catch {
        /* keep local cache */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Mirror to AsyncStorage on every change (post-hydration only) ──
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(custom)).catch(
      () => {
        /* device storage failure — surface a banner later if needed */
      }
    );
  }, [custom]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(
      STORAGE_KEY_HIDDEN,
      JSON.stringify(Array.from(hiddenDefaults))
    ).catch(() => {});
  }, [hiddenDefaults]);

  const addAddiction = useCallback(
    async (input: NewAddictionInput): Promise<Addiction> => {
      const sanitized: NewAddictionInput = {
        ...input,
        sensitivity: Math.max(1, Math.min(10, Math.round(input.sensitivity))),
      };
      // Optimistic — show the new tile immediately under a temp id.
      const tempId = `custom-temp-${Date.now()}`;
      const optimistic: Addiction = {
        id: tempId,
        name: sanitized.name,
        emoji: sanitized.emoji,
        iconLib: 'mci',
        iconName: 'star-circle',
        color: sanitized.color,
        bgGlow: hexToRgba(sanitized.color, 0.16),
        sensitivity: sanitized.sensitivity,
      };
      setCustom((prev) => [...prev, optimistic]);

      if (!user) {
        // Offline / dev-bypass — keep the optimistic row, no server hop.
        return optimistic;
      }
      try {
        const real = await createAddiction({ ...sanitized, userId: user.id });
        setCustom((prev) => prev.map((a) => (a.id === tempId ? real : a)));
        return real;
      } catch {
        // Roll back the optimistic tile on failure.
        setCustom((prev) => prev.filter((a) => a.id !== tempId));
        throw new Error('Eklenemedi. İnternet bağlantını kontrol et.');
      }
    },
    [user]
  );

  const removeAddiction = useCallback(
    async (id: string) => {
      if (id.startsWith('custom-')) {
        const snapshot = custom;
        setCustom((prev) => prev.filter((a) => a.id !== id));
        if (!user) return;
        try {
          await deleteAddictionRow(id);
        } catch {
          // Network failed — restore the row so the user knows it's still there.
          setCustom(snapshot);
        }
      } else {
        const next = new Set(hiddenDefaults);
        next.add(id);
        const snapshot = hiddenDefaults;
        setHiddenDefaults(next);
        if (!user) return;
        try {
          await persistHiddenDefaults(user.id, next);
        } catch {
          setHiddenDefaults(snapshot);
        }
      }
    },
    [custom, hiddenDefaults, user]
  );

  const updateAddiction = useCallback(
    async (id: string, patch: AddictionPatch) => {
      if (!id.startsWith('custom-')) return;
      const snapshot = custom;
      const sanitizedSensitivity =
        patch.sensitivity != null
          ? Math.max(1, Math.min(10, Math.round(patch.sensitivity)))
          : undefined;
      setCustom((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          const nextColor = patch.color ?? a.color;
          return {
            ...a,
            name: patch.name ?? a.name,
            emoji: patch.emoji ?? a.emoji,
            color: nextColor,
            bgGlow: patch.color ? hexToRgba(nextColor, 0.16) : a.bgGlow,
            sensitivity: sanitizedSensitivity ?? a.sensitivity,
          };
        })
      );
      if (!user || id.startsWith('custom-temp-')) {
        // No server roundtrip when offline or when the row is still
        // optimistic-pending (the create call will pick up the latest
        // state when it resolves… in practice we never expose the temp
        // id to UI long enough for an edit to matter, but be safe).
        return;
      }
      try {
        await updateAddictionRow(id, {
          ...(patch.name != null ? { name: patch.name } : {}),
          ...(patch.emoji != null ? { emoji: patch.emoji } : {}),
          ...(patch.color != null ? { color: patch.color } : {}),
          ...(sanitizedSensitivity != null ? { sensitivity: sanitizedSensitivity } : {}),
        });
      } catch {
        setCustom(snapshot);
      }
    },
    [custom, user]
  );

  const addictions = useMemo(() => {
    const visibleDefaults = DEFAULT_ADDICTIONS.filter((a) => !hiddenDefaults.has(a.id));
    return [...visibleDefaults, ...custom];
  }, [custom, hiddenDefaults]);

  return (
    <AddictionsContext.Provider
      value={{ addictions, addAddiction, removeAddiction, updateAddiction }}
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
