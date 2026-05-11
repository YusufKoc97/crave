import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Chain-thenable Supabase builder mock. Each chain method (select, eq,
 * order, in, single, maybeSingle, update, delete, insert) returns the
 * same builder; the final await resolves to whatever response the test
 * placed in `mock.response`.
 *
 * Has to live inside `vi.hoisted` because Vitest hoists the `vi.mock`
 * factory above the imports — anything the factory references must
 * also be hoisted, or it'd be a TDZ reference error.
 */
type Response = { data: unknown; error: unknown };

const mock = vi.hoisted(() => {
  const state = {
    response: { data: null as unknown, error: null as unknown } as Response,
    chain: [] as Array<[string, unknown[]]>,
  };
  const builder: object = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (r: Response) => void) => resolve(state.response);
        }
        return (...args: unknown[]) => {
          state.chain.push([String(prop), args]);
          return builder;
        };
      },
    }
  );
  return {
    supabase: {
      from: (table: string) => {
        state.chain.push(['from', [table]]);
        return builder;
      },
    },
    state,
  };
});

vi.mock('@/lib/supabase', () => ({ supabase: mock.supabase }));

// Imports MUST come after vi.mock so the mock is in place.
import {
  createAddiction,
  deleteAddictionRow,
  fetchCustomAddictions,
  fetchHiddenDefaults,
  persistHiddenDefaults,
  updateAddictionRow,
} from '@/lib/addictionsApi';

beforeEach(() => {
  mock.state.response = { data: null, error: null };
  mock.state.chain = [];
});

describe('fetchCustomAddictions', () => {
  it('maps DB rows to Addiction shape with custom- prefix', async () => {
    mock.state.response = {
      data: [
        {
          id: 'aaaa-1',
          name: 'Late-night Instagram',
          emoji: '📱',
          color: '#EC4899',
          sensitivity: 6,
        },
      ],
      error: null,
    };
    const out = await fetchCustomAddictions('user-1');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('custom-aaaa-1');
    expect(out[0].name).toBe('Late-night Instagram');
    expect(out[0].sensitivity).toBe(6);
    expect(out[0].bgGlow).toMatch(/^rgba\(/);
  });

  it('returns [] when DB returns null', async () => {
    mock.state.response = { data: null, error: null };
    const out = await fetchCustomAddictions('user-1');
    expect(out).toEqual([]);
  });

  it('throws when the DB returns an error', async () => {
    mock.state.response = { data: null, error: { code: '42501' } };
    await expect(fetchCustomAddictions('user-1')).rejects.toBeDefined();
  });

  it('clamps wildly out-of-range sensitivity into 1..10', async () => {
    mock.state.response = {
      data: [
        { id: 'a', name: 'x', emoji: '🌪', color: '#10B981', sensitivity: 99 },
        { id: 'b', name: 'y', emoji: '🌪', color: '#10B981', sensitivity: -3 },
        { id: 'c', name: 'z', emoji: '🌪', color: '#10B981', sensitivity: 4.7 },
      ],
      error: null,
    };
    const out = await fetchCustomAddictions('u');
    expect(out.map((a) => a.sensitivity)).toEqual([10, 1, 5]);
  });

  it('hits the addictions table with a user_id filter and chronological order', async () => {
    mock.state.response = { data: [], error: null };
    await fetchCustomAddictions('user-42');
    const names = mock.state.chain.map(([n]) => n);
    expect(names).toContain('from');
    expect(names).toContain('select');
    expect(names).toContain('eq');
    expect(names).toContain('order');
    // The eq filter targets user_id with our argument.
    const eqCall = mock.state.chain.find(([n]) => n === 'eq');
    expect(eqCall?.[1]).toEqual(['user_id', 'user-42']);
    // Ascending order matches "newest at the end" UX semantics.
    const orderCall = mock.state.chain.find(([n]) => n === 'order');
    expect(orderCall?.[1]).toEqual(['created_at', { ascending: true }]);
  });
});

describe('fetchHiddenDefaults', () => {
  it('returns a Set from the profiles.hidden_defaults array', async () => {
    mock.state.response = {
      data: { hidden_defaults: ['nicotine', 'alcohol'] },
      error: null,
    };
    const out = await fetchHiddenDefaults('user-1');
    expect(out).toBeInstanceOf(Set);
    expect(out.has('nicotine')).toBe(true);
    expect(out.has('alcohol')).toBe(true);
    expect(out.has('caffeine')).toBe(false);
  });

  it('handles null hidden_defaults as empty Set', async () => {
    mock.state.response = { data: { hidden_defaults: null }, error: null };
    const out = await fetchHiddenDefaults('user-1');
    expect(out.size).toBe(0);
  });

  it('handles missing profile row as empty Set', async () => {
    mock.state.response = { data: null, error: null };
    const out = await fetchHiddenDefaults('user-1');
    expect(out.size).toBe(0);
  });

  it('throws on DB error', async () => {
    mock.state.response = { data: null, error: { code: '42501' } };
    await expect(fetchHiddenDefaults('u')).rejects.toBeDefined();
  });
});

describe('createAddiction', () => {
  it('inserts user_id + name + emoji + color + sensitivity and returns prefixed Addiction', async () => {
    mock.state.response = {
      data: {
        id: 'new-uuid',
        name: 'Test',
        emoji: '🎮',
        color: '#3B82F6',
        sensitivity: 7,
      },
      error: null,
    };
    const out = await createAddiction({
      userId: 'user-1',
      name: 'Test',
      emoji: '🎮',
      color: '#3B82F6',
      sensitivity: 7,
    });
    expect(out.id).toBe('custom-new-uuid');
    expect(out.sensitivity).toBe(7);
    const insertCall = mock.state.chain.find(([n]) => n === 'insert');
    expect(insertCall).toBeDefined();
    const payload = insertCall?.[1][0] as Record<string, unknown>;
    expect(payload.user_id).toBe('user-1');
    expect(payload.color).toBe('#3B82F6');
    expect(payload.sensitivity).toBe(7);
    // Legacy column gets a non-null derived value (>= 5).
    expect(typeof payload.max_duration_minutes).toBe('number');
    expect(payload.max_duration_minutes).toBeGreaterThanOrEqual(5);
  });

  it('throws when the server rejects the insert', async () => {
    mock.state.response = { data: null, error: { code: '23505' } };
    await expect(
      createAddiction({
        userId: 'u',
        name: 'x',
        emoji: '🌪',
        color: '#10B981',
        sensitivity: 5,
      })
    ).rejects.toBeDefined();
  });
});

describe('updateAddictionRow', () => {
  it("strips the 'custom-' prefix and sends only the patched fields", async () => {
    mock.state.response = { data: null, error: null };
    await updateAddictionRow('custom-abc-123', {
      name: 'Renamed',
      sensitivity: 8,
    });
    const updateCall = mock.state.chain.find(([n]) => n === 'update');
    expect(updateCall?.[1][0]).toEqual({
      name: 'Renamed',
      sensitivity: 8,
    });
    const eqCall = mock.state.chain.find(([n]) => n === 'eq');
    // The raw uuid (no prefix) is what hits the WHERE clause.
    expect(eqCall?.[1]).toEqual(['id', 'abc-123']);
  });

  it('throws on update error', async () => {
    mock.state.response = { data: null, error: { code: '42501' } };
    await expect(
      updateAddictionRow('custom-x', { name: 'y' })
    ).rejects.toBeDefined();
  });
});

describe('deleteAddictionRow', () => {
  it('strips prefix and deletes by id', async () => {
    mock.state.response = { data: null, error: null };
    await deleteAddictionRow('custom-zz-9');
    const names = mock.state.chain.map(([n]) => n);
    expect(names).toContain('delete');
    const eqCall = mock.state.chain.find(([n]) => n === 'eq');
    expect(eqCall?.[1]).toEqual(['id', 'zz-9']);
  });

  it('throws on delete error', async () => {
    mock.state.response = { data: null, error: { code: '42501' } };
    await expect(deleteAddictionRow('custom-x')).rejects.toBeDefined();
  });
});

describe('persistHiddenDefaults', () => {
  it('writes a sorted-input-stable text array to the user row', async () => {
    mock.state.response = { data: null, error: null };
    await persistHiddenDefaults('user-1', new Set(['nicotine', 'feed']));
    const updateCall = mock.state.chain.find(([n]) => n === 'update');
    const payload = updateCall?.[1][0] as { hidden_defaults: string[] };
    expect(Array.isArray(payload.hidden_defaults)).toBe(true);
    expect(payload.hidden_defaults.sort()).toEqual(['feed', 'nicotine']);
    const eqCall = mock.state.chain.find(([n]) => n === 'eq');
    expect(eqCall?.[1]).toEqual(['id', 'user-1']);
  });

  it('writes an empty array when the Set is empty', async () => {
    mock.state.response = { data: null, error: null };
    await persistHiddenDefaults('u', new Set());
    const updateCall = mock.state.chain.find(([n]) => n === 'update');
    expect(updateCall?.[1][0]).toEqual({ hidden_defaults: [] });
  });

  it('throws on update error', async () => {
    mock.state.response = { data: null, error: { code: '42501' } };
    await expect(persistHiddenDefaults('u', new Set())).rejects.toBeDefined();
  });
});
