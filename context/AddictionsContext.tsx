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

type NewAddictionInput = {
  name: string;
  emoji: string;
  color: string;
  sensitivity: number;
};

type AddictionPatch = Partial<NewAddictionInput>;

type AddictionsContextValue = {
  addictions: Addiction[];
  addAddiction: (input: NewAddictionInput) => Addiction;
  removeAddiction: (id: string) => void;
  /**
   * Update fields on an existing custom addiction. Updates on default
   * (preset) addictions are a no-op — defaults are intentionally
   * read-only so the community filters and seed icons stay stable.
   */
  updateAddiction: (id: string, patch: AddictionPatch) => void;
};

const AddictionsContext = createContext<AddictionsContextValue | undefined>(undefined);

const STORAGE_KEY_CUSTOM = 'addictions_custom_v1';
const STORAGE_KEY_HIDDEN = 'addictions_hidden_defaults_v1';

export function AddictionsProvider({ children }: { children: ReactNode }) {
  const [custom, setCustom] = useState<Addiction[]>([]);
  const [hiddenDefaults, setHiddenDefaults] = useState<Set<string>>(new Set());
  // Don't persist back to disk until we've finished the initial read,
  // otherwise the effect runs once with empty state and overwrites the
  // saved blob.
  const hydrated = useRef(false);

  // ── Hydrate from AsyncStorage on mount ──────────────────────────────
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

  // ── Persist on every change, but only after hydration completes ────
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(custom)).catch(
      () => {
        /* device storage failure — surface a banner later if it becomes a real issue */
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

  const addAddiction = useCallback((input: NewAddictionInput): Addiction => {
    const next: Addiction = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.name,
      emoji: input.emoji,
      iconLib: 'mci',
      iconName: 'star-circle',
      color: input.color,
      bgGlow: hexToRgba(input.color, 0.16),
      sensitivity: Math.max(1, Math.min(10, Math.round(input.sensitivity))),
    };
    setCustom((prev) => [...prev, next]);
    return next;
  }, []);

  const removeAddiction = useCallback((id: string) => {
    if (id.startsWith('custom-')) {
      setCustom((prev) => prev.filter((a) => a.id !== id));
    } else {
      setHiddenDefaults((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }, []);

  const updateAddiction = useCallback((id: string, patch: AddictionPatch) => {
    if (!id.startsWith('custom-')) return;
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
          sensitivity:
            patch.sensitivity != null
              ? Math.max(1, Math.min(10, Math.round(patch.sensitivity)))
              : a.sensitivity,
        };
      })
    );
  }, []);

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

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
