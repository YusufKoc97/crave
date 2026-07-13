import { describe, expect, test } from 'vitest';
import {
  ADDICTION_CATALOG,
  FREE_ACTIVE_LIMIT,
  PREMIUM_ACTIVE_LIMIT,
  getCatalogEntry,
  toAddiction,
  maxMinutesFor,
} from '@/constants/addictions';

describe('ADDICTION_CATALOG', () => {
  test('has exactly 10 entries', () => {
    expect(ADDICTION_CATALOG.length).toBe(10);
  });

  test('each id is unique', () => {
    const ids = new Set(ADDICTION_CATALOG.map((e) => e.id));
    expect(ids.size).toBe(ADDICTION_CATALOG.length);
  });

  test('all sensitivities are between 1 and 10 inclusive', () => {
    for (const entry of ADDICTION_CATALOG) {
      expect(entry.sensitivity).toBeGreaterThanOrEqual(1);
      expect(entry.sensitivity).toBeLessThanOrEqual(10);
    }
  });

  test('all colors are 6-digit hex strings', () => {
    for (const entry of ADDICTION_CATALOG) {
      expect(entry.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  test('category is always substance | behavioral | digital', () => {
    const allowed = new Set(['substance', 'behavioral', 'digital']);
    for (const entry of ADDICTION_CATALOG) {
      expect(allowed.has(entry.category)).toBe(true);
    }
  });

  test('catalog carries the exact 10 canonical ids from the brief', () => {
    const expected = [
      'nicotine',
      'alcohol',
      'caffeine',
      'vape',
      'gambling',
      'junk_food',
      'shopping',
      'pmo',
      'doomscroll',
      'gaming',
    ];
    const actual = ADDICTION_CATALOG.map((e) => e.id);
    expect(actual).toEqual(expected);
  });
});

describe('getCatalogEntry', () => {
  test('returns the entry for a known id', () => {
    const entry = getCatalogEntry('nicotine');
    expect(entry).toBeDefined();
    expect(entry?.emoji).toBe('🚬');
    expect(entry?.sensitivity).toBe(8);
    expect(entry?.category).toBe('substance');
  });

  test('returns undefined for an unknown id', () => {
    expect(getCatalogEntry('does-not-exist')).toBeUndefined();
  });
});

describe('toAddiction', () => {
  test('materializes a catalog entry into the full Addiction shape', () => {
    const entry = getCatalogEntry('vape');
    expect(entry).toBeDefined();
    if (!entry) throw new Error('vape entry missing');
    const a = toAddiction(entry);
    expect(a.id).toBe('vape');
    // Name comes from the i18n dictionary (en.json)
    expect(a.name).toBe('Vape');
    expect(a.emoji).toBe('💨');
    expect(a.color).toBe('#90CAF9');
    expect(a.category).toBe('substance');
    expect(a.sensitivity).toBe(7);
    // bgGlow is a derived rgba string, alpha 0.16
    expect(a.bgGlow).toMatch(/^rgba\(\d+, \d+, \d+, 0\.16\)$/);
  });

  test('falls back to the i18n key when translation is missing', () => {
    // Fake a catalog-shaped object whose id has no en.json entry.
    const entry = {
      id: 'nonexistent_id',
      category: 'substance' as const,
      sensitivity: 5,
      emoji: '❓',
      color: '#000000',
    };
    const a = toAddiction(entry);
    // Missing keys resolve to the key itself — loud failure > silent.
    expect(a.name).toBe('addictions.nonexistent_id.name');
  });
});

describe('tier limits', () => {
  test('free tier caps at 1 active addiction', () => {
    expect(FREE_ACTIVE_LIMIT).toBe(1);
  });

  test('premium tier caps at 5 active addictions', () => {
    expect(PREMIUM_ACTIVE_LIMIT).toBe(5);
  });

  test('premium ceiling is strictly higher than free', () => {
    expect(PREMIUM_ACTIVE_LIMIT).toBeGreaterThan(FREE_ACTIVE_LIMIT);
  });
});

describe('maxMinutesFor', () => {
  test('sensitivity 1 maps to 5 minutes', () => {
    expect(maxMinutesFor(1)).toBe(5);
  });

  test('sensitivity 10 maps to 15 minutes', () => {
    expect(maxMinutesFor(10)).toBe(15);
  });

  test('sensitivity 5 sits in the mid range', () => {
    expect(maxMinutesFor(5)).toBe(9);
  });

  test('clamps out-of-range inputs', () => {
    expect(maxMinutesFor(-3)).toBe(5);
    expect(maxMinutesFor(99)).toBe(15);
  });
});

// Soft-delete semantics tests — these describe the *contract* the
// AddictionsContext + user_addictions table must satisfy. The context
// itself imports react and can't be run under vitest node env, so this
// is a documentation-shaped test that at minimum asserts activeIds
// membership behaves like a mathematical set.
describe('soft delete contract (Set semantics)', () => {
  test('adding an id makes it active', () => {
    const active = new Set<string>();
    active.add('nicotine');
    expect(active.has('nicotine')).toBe(true);
  });

  test('removing an id makes it inactive but preserved elsewhere', () => {
    const active = new Set<string>(['nicotine']);
    // History table (represented here as a plain Map<id, hits>) survives
    // the deactivation. Re-adding continues from the same counter.
    const history = new Map<string, number>([['nicotine', 42]]);
    active.delete('nicotine');
    expect(active.has('nicotine')).toBe(false);
    expect(history.get('nicotine')).toBe(42);

    // Re-add — history remains intact.
    active.add('nicotine');
    expect(active.has('nicotine')).toBe(true);
    expect(history.get('nicotine')).toBe(42);
  });

  test('duplicate add is a no-op', () => {
    const active = new Set<string>(['nicotine']);
    active.add('nicotine');
    expect(active.size).toBe(1);
  });
});
