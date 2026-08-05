import { describe, expect, it } from 'vitest';
import { t } from '@/lib/i18n';
import {
  FAKE_FEED_CARDS,
  FAKE_FEED_CARD_COUNT,
  FAKE_FEED_DEPLETION_START,
  feedStep,
} from '@/components/technique/fakeFeedCards';

const DWELL = 7000;

/**
 * Fake Feed's guardrails are the exercise. A feed that grew past ten
 * cards, looped, or let a fast scroller outrun the pace would quietly
 * become the habit it treats — so they are asserted here rather than
 * left to the component's good intentions.
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

  it('completes on the last card instead of unlocking an eleventh', () => {
    const step = feedStep({
      index: FAKE_FEED_CARD_COUNT - 1,
      unlocked: FAKE_FEED_CARD_COUNT,
      dwellMs: DWELL,
      requiredMs: DWELL,
    });
    expect(step.kind).toBe('complete');
  });

  it('never unlocks beyond the tenth card, however long it runs', () => {
    let unlocked = 1;
    for (let index = 0; index < FAKE_FEED_CARD_COUNT + 5; index++) {
      for (let tick = 0; tick < 50; tick++) {
        const step = feedStep({
          index: Math.min(index, FAKE_FEED_CARD_COUNT - 1),
          unlocked,
          dwellMs: DWELL * 10,
          requiredMs: DWELL,
        });
        if (step.kind === 'unlock') unlocked = step.unlocked;
      }
    }
    expect(unlocked).toBeLessThanOrEqual(FAKE_FEED_CARD_COUNT);
  });
});

describe('Fake Feed — pace guard', () => {
  it('unlocks nothing before the card has served its dwell', () => {
    for (const dwellMs of [0, 1, DWELL - 1]) {
      expect(
        feedStep({ index: 0, unlocked: 1, dwellMs, requiredMs: DWELL })
      ).toEqual({ kind: 'wait' });
    }
  });

  it('unlocks exactly one card once the dwell is served', () => {
    expect(
      feedStep({ index: 0, unlocked: 1, dwellMs: DWELL, requiredMs: DWELL })
    ).toEqual({ kind: 'unlock', unlocked: 2 });
  });

  it('cannot be outrun: a full run needs ten dwells', () => {
    // Simulates the fastest possible user — scrolls to the tip the
    // instant a card appears — and counts how many cards the run serves.
    let unlocked = 1;
    let index = 0;
    let dwellMs = 0;
    let served = 0;
    let completed = false;
    for (let tick = 0; tick < 10_000 && !completed; tick++) {
      dwellMs += 100;
      const step = feedStep({ index, unlocked, dwellMs, requiredMs: DWELL });
      if (step.kind === 'unlock') {
        unlocked = step.unlocked;
        served++;
        index = unlocked - 1; // instant scroll to the newest card
        dwellMs = 0; // the new card starts its own clock
      } else if (step.kind === 'complete') {
        completed = true;
        served++;
      }
    }
    expect(completed).toBe(true);
    expect(served).toBe(FAKE_FEED_CARD_COUNT);
  });

  it('scrolling back to an earlier card unlocks nothing', () => {
    // Feed tip is card 5 (unlocked=5); user scrolls back to card 2 and
    // waits. Re-reading must not extend the feed.
    expect(
      feedStep({ index: 1, unlocked: 5, dwellMs: DWELL * 3, requiredMs: DWELL })
    ).toEqual({ kind: 'wait' });
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
