import { t } from '@/lib/i18n';

/**
 * Faz 2 — Fixed 10-item catalog. Users can only track addictions from
 * this list; there is no custom creation. Names come from i18n
 * (`addictions.<id>.name`), so this constant carries structure only.
 *
 * `sensitivity` is used server-side (Faz 3) in the scoring formula and
 * for the timer ceiling via `maxMinutesFor()` — the user never sees or
 * edits this value.
 */

export type AddictionCategory = 'substance' | 'behavioral' | 'digital';

/** Structural shape used everywhere the app renders an addiction. */
export type Addiction = {
  id: string;
  /** Display name resolved via `t('addictions.<id>.name')`. */
  name: string;
  emoji: string;
  color: string;
  /** rgba string derived from `color` — cheap to precompute once. */
  bgGlow: string;
  sensitivity: number;
  category: AddictionCategory;
};

/** Raw catalog row — same shape as the DB seed, minus display fields. */
type CatalogEntry = {
  id: string;
  category: AddictionCategory;
  sensitivity: number;
  emoji: string;
  color: string;
};

/**
 * The 10-item catalog. Order here IS the display order in the picker
 * (grouped by category further down at render time).
 */
export const ADDICTION_CATALOG: readonly CatalogEntry[] = [
  {
    id: 'nicotine',
    category: 'substance',
    sensitivity: 8,
    emoji: '🚬',
    color: '#B0B0B0',
  },
  {
    id: 'alcohol',
    category: 'substance',
    sensitivity: 8,
    emoji: '🍺',
    color: '#F5C518',
  },
  {
    id: 'caffeine',
    category: 'substance',
    sensitivity: 5,
    emoji: '☕',
    color: '#A0522D',
  },
  {
    id: 'vape',
    category: 'substance',
    sensitivity: 7,
    emoji: '💨',
    color: '#90CAF9',
  },
  {
    id: 'gambling',
    category: 'behavioral',
    sensitivity: 8,
    emoji: '🎰',
    color: '#E53935',
  },
  {
    id: 'junk_food',
    category: 'behavioral',
    sensitivity: 7,
    emoji: '🍔',
    color: '#FF9800',
  },
  {
    id: 'shopping',
    category: 'behavioral',
    sensitivity: 6,
    emoji: '🛍️',
    color: '#EC407A',
  },
  {
    id: 'pmo',
    category: 'behavioral',
    sensitivity: 8,
    emoji: '🙈',
    color: '#AB47BC',
  },
  {
    id: 'doomscroll',
    category: 'digital',
    sensitivity: 6,
    emoji: '📱',
    color: '#42A5F5',
  },
  {
    id: 'gaming',
    category: 'digital',
    sensitivity: 6,
    emoji: '🎮',
    color: '#7E57C2',
  },
] as const;

/** Fast id → catalog lookup. */
const BY_ID: Record<string, CatalogEntry> = ADDICTION_CATALOG.reduce(
  (acc, row) => {
    acc[row.id] = row;
    return acc;
  },
  {} as Record<string, CatalogEntry>
);

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return BY_ID[id];
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Materialize a catalog entry into the full `Addiction` shape the UI
 * expects. Name is resolved via i18n at call time so language
 * switching (future) reflows without a data change.
 */
export function toAddiction(entry: CatalogEntry): Addiction {
  return {
    id: entry.id,
    name: t(`addictions.${entry.id}.name`),
    emoji: entry.emoji,
    color: entry.color,
    bgGlow: hexToRgba(entry.color, 0.16),
    sensitivity: entry.sensitivity,
    category: entry.category,
  };
}

/** Free tier: 1 active addiction. Premium: 5. */
export const FREE_ACTIVE_LIMIT = 1;
export const PREMIUM_ACTIVE_LIMIT = 5;

/**
 * Map a 1-10 sensitivity score to one craving cycle in minutes. Tuned
 * to the 5-15 min window where most urges naturally peak and pass —
 * long ceilings (30+ min) felt punishing in usability tests.
 *
 *   1 → 5 min, 5 → 9 min, 10 → 15 min
 */
export function maxMinutesFor(sensitivity: number): number {
  const s = Math.max(1, Math.min(10, sensitivity));
  return Math.round(5 + (s - 1) * (10 / 9));
}
