import { describe, expect, it } from 'vitest';
import { t } from '@/lib/i18n';
import {
  FAKE_FEED_CARDS,
  FAKE_FEED_CARD_COUNT,
  FAKE_FEED_DEPLETION_START,
} from '@/components/technique/fakeFeedCards';

/**
 * Fake Feed's guardrails are the exercise. The feed is free-scroll (the
 * user moves at their own pace), so the property that keeps it from
 * becoming the habit it treats is finiteness, not a timer: exactly ten
 * cards, a fixed descent, and a real ending. Those are asserted here
 * rather than left to the component's good intentions.
 */
describe('Fake Feed — FINITE', () => {
  it('has exactly ten cards', () => {
    expect(FAKE_FEED_CARD_COUNT).toBe(10);
    expect(FAKE_FEED_CARDS).toHaveLength(10);
  });

  it('keeps the deliberate card order', () => {
    expect(FAKE_FEED_CARDS.map((c) => c.key)).toEqual([
      'invitation',
      'speed_mirror',
      'thumb',
      'number',
      'empty_search',
      'slow_pulse',
      'hold',
      'winding_down',
      'bottom',
      'end',
    ]);
  });
});

describe('Fake Feed — copy', () => {
  it('every card resolves to a real string, not a raw key path', () => {
    for (const card of FAKE_FEED_CARDS) {
      const key = `toolkit.techniques.fake_feed.cards.${card.key}`;
      // lib/i18n returns the key itself when a lookup misses, so a
      // rename would otherwise ship "toolkit.techniques…" to the user.
      expect(t(key), `missing i18n for ${key}`).not.toBe(key);
      expect(t(key).length).toBeGreaterThan(0);
    }
  });

  it('promises no interaction the skeleton cannot honour', () => {
    // The skeleton has no hold gesture, no pulse and no tap targets.
    // Copy that invites one would leave the user pressing a dead card.
    const holdish = /\bhold\b|\bpress\b|\btap\b|\blong.press\b/i;
    for (const card of FAKE_FEED_CARDS.slice(1)) {
      const line = t(`toolkit.techniques.fake_feed.cards.${card.key}`);
      expect(
        holdish.test(line),
        `${card.key} promises a gesture: ${line}`
      ).toBe(false);
    }
  });
});

describe('Fake Feed — DEPLETES', () => {
  it('fades only the closing stretch, monotonically', () => {
    const depleted = FAKE_FEED_CARDS.filter((c) => c.depletion != null);
    expect(depleted).toHaveLength(3);
    expect(FAKE_FEED_DEPLETION_START).toBe(7);
    const values = depleted.map((c) => c.depletion as number);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it('leaves the opening cards at full strength', () => {
    for (const card of FAKE_FEED_CARDS.slice(0, FAKE_FEED_DEPLETION_START)) {
      expect(card.depletion ?? 0).toBe(0);
    }
  });
});
