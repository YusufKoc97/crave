import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_ADDICTIONS, type Addiction } from '@/constants/addictions';

type NewAddictionInput = {
  name: string;
  emoji: string;
  color: string;
  sensitivity: number;
};

type AddictionsContextValue = {
  addictions: Addiction[];
  addAddiction: (input: NewAddictionInput) => Addiction;
  removeAddiction: (id: string) => void;
};

const AddictionsContext = createContext<AddictionsContextValue | undefined>(undefined);

export function AddictionsProvider({ children }: { children: ReactNode }) {
  const [custom, setCustom] = useState<Addiction[]>([]);
  const [hiddenDefaults, setHiddenDefaults] = useState<Set<string>>(new Set());

  const addAddiction = (input: NewAddictionInput): Addiction => {
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
  };

  const removeAddiction = (id: string) => {
    if (id.startsWith('custom-')) {
      setCustom((prev) => prev.filter((a) => a.id !== id));
    } else {
      setHiddenDefaults((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  };

  const addictions = useMemo(() => {
    const visibleDefaults = DEFAULT_ADDICTIONS.filter((a) => !hiddenDefaults.has(a.id));
    return [...visibleDefaults, ...custom];
  }, [custom, hiddenDefaults]);

  return (
    <AddictionsContext.Provider value={{ addictions, addAddiction, removeAddiction }}>
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
