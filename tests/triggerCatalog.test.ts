import { describe, expect, it } from 'vitest';
import {
  ADDICTION_TRIGGERS,
  COMMON_TRIGGERS,
  triggersFor,
  triggerLabel,
  type Trigger,
} from '@/constants/triggerCatalog';
import { ADDICTION_CATALOG } from '@/constants/addictions';

/**
 * Faz 5 — client-side trigger catalog invariants. No Edge Function
 * or DB cross-check runs against these values, so the catalog is
 * the sole source of truth for what a valid trigger id looks like.
 */

describe('COMMON_TRIGGERS', () => {
  it('has exactly 8 common triggers (brief spec)', () => {
    expect(COMMON_TRIGGERS.length).toBe(8);
  });

  it('every common row is scoped "common"', () => {
    for (const t of COMMON_TRIGGERS) {
      expect(t.scope).toBe('common');
    }
  });

  it('ids are unique within the common set', () => {
    const ids = new Set(COMMON_TRIGGERS.map((t) => t.id));
    expect(ids.size).toBe(COMMON_TRIGGERS.length);
  });

  it('displayOrder is 1..N monotonic', () => {
    const sorted = [...COMMON_TRIGGERS].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i].displayOrder).toBe(i + 1);
    }
  });
});

describe('ADDICTION_TRIGGERS', () => {
  it('has an entry for every addiction in the catalog', () => {
    for (const addiction of ADDICTION_CATALOG) {
      expect(ADDICTION_TRIGGERS[addiction.id]).toBeDefined();
    }
  });

  it('every specific trigger scope matches its map key', () => {
    for (const [addictionId, triggers] of Object.entries(ADDICTION_TRIGGERS)) {
      for (const t of triggers) {
        expect(t.scope).toBe(addictionId);
      }
    }
  });

  it('ids are unique within each addiction bucket', () => {
    for (const [, triggers] of Object.entries(ADDICTION_TRIGGERS)) {
      const ids = new Set(triggers.map((t) => t.id));
      expect(ids.size).toBe(triggers.length);
    }
  });

  it('every addiction has at least 5 specific triggers', () => {
    for (const [addictionId, triggers] of Object.entries(ADDICTION_TRIGGERS)) {
      expect(
        triggers.length,
        `${addictionId} should have >=5 specific triggers`
      ).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('triggersFor', () => {
  it('returns the correct list for a known addiction', () => {
    const nicotine = triggersFor('nicotine');
    expect(nicotine.length).toBe(8);
    expect(nicotine[0].id).toBe('after_coffee');
  });

  it('returns [] for an unknown addiction id', () => {
    expect(triggersFor('not_a_real_addiction')).toEqual([]);
  });
});

describe('triggerLabel', () => {
  it('routes common scope through triggers.common.<id>', () => {
    const t: Trigger = { id: 'stress', scope: 'common', displayOrder: 1 };
    // Just resolves to the literal from en.json — see i18n snapshot.
    expect(triggerLabel(t)).toBe('Stress');
  });

  it('routes addiction scope through triggers.<addictionId>.<id>', () => {
    const t: Trigger = {
      id: 'after_coffee',
      scope: 'nicotine',
      displayOrder: 1,
    };
    expect(triggerLabel(t)).toBe('After coffee');
  });

  it('returns the key path (loud fallback) when the label is missing', () => {
    const t: Trigger = {
      id: 'does_not_exist',
      scope: 'nicotine',
      displayOrder: 99,
    };
    // Loud fallback: the resolver returns the missing key so a dev
    // spots the gap on-screen instead of shipping an empty chip.
    expect(triggerLabel(t)).toBe('triggers.nicotine.does_not_exist');
  });
});

describe('i18n coverage', () => {
  it('every common trigger has a label in en.json', () => {
    for (const trigger of COMMON_TRIGGERS) {
      const label = triggerLabel(trigger);
      expect(
        label.startsWith('triggers.'),
        `missing i18n for triggers.common.${trigger.id} (got "${label}")`
      ).toBe(false);
    }
  });

  it('every addiction-specific trigger has a label in en.json', () => {
    for (const [addictionId, triggers] of Object.entries(ADDICTION_TRIGGERS)) {
      for (const trigger of triggers) {
        const label = triggerLabel(trigger);
        expect(
          label.startsWith('triggers.'),
          `missing i18n for triggers.${addictionId}.${trigger.id} (got "${label}")`
        ).toBe(false);
      }
    }
  });
});
