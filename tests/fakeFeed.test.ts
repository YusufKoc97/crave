import { describe, expect, it } from 'vitest';
import { t } from '@/lib/i18n';
import {
  FAKE_FEED_CARDS,
  FAKE_FEED_CARD_COUNT,
  FAKE_FEED_DEPLETION_START,
} from '@/components/technique/fakeFeedCards';
import {
  FAKE_FEED_NUMBER,
  FAKE_FEED_NUMBER_TOTAL_MS,
  contextOpacity,
  countUpValue,
  easeOutBack,
  entranceOpacity,
  entranceScale,
} from '@/components/technique/fakeFeedNumber';
import {
  FILL_FAST_MIN,
  FILL_SLOW_MAX,
  FILL_TOTAL_RAD,
  SCROLL_CASCADE_COUNT,
  SCROLL_CASCADE_CYCLE_MS,
  cascadeChevron,
  fillGain,
} from '@/components/technique/fakeFeedMotion';

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

describe('Fake Feed — card 4 count-up', () => {
  const { distance, videos } = FAKE_FEED_NUMBER;

  it('each number starts at zero and lands exactly on its target', () => {
    expect(countUpValue(0, distance)).toBe(0);
    expect(countUpValue(distance.startMs, distance)).toBe(0);
    expect(countUpValue(distance.startMs + distance.durationMs, distance)).toBe(
      distance.target
    );
    // and never overshoots after it has landed
    expect(countUpValue(FAKE_FEED_NUMBER_TOTAL_MS, distance)).toBe(
      distance.target
    );
    expect(countUpValue(FAKE_FEED_NUMBER_TOTAL_MS, videos)).toBe(videos.target);
  });

  it('counts monotonically upward', () => {
    let prev = -1;
    for (
      let e = distance.startMs;
      e <= distance.startMs + distance.durationMs;
      e += 50
    ) {
      const v = countUpValue(e, distance);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('decelerates (ease-out): past halfway by the time-midpoint', () => {
    const mid = distance.startMs + distance.durationMs / 2;
    // A linear ramp would sit at 50% here; ease-out is already past it.
    expect(countUpValue(mid, distance)).toBeGreaterThan(distance.target * 0.5);
  });

  it('runs the two numbers together, both from zero', () => {
    expect(distance.startMs).toBe(0);
    expect(videos.startMs).toBe(0);
    // both are mid-count at the same instant — not a relay
    const mid = distance.durationMs / 2;
    for (const spec of [distance, videos]) {
      expect(countUpValue(mid, spec)).toBeGreaterThan(0);
      expect(countUpValue(mid, spec)).toBeLessThan(spec.target);
    }
  });

  it('holds the context lines back until both numbers have landed', () => {
    expect(contextOpacity(0)).toBe(0);
    expect(contextOpacity(FAKE_FEED_NUMBER.contextStartMs)).toBe(0);
    expect(contextOpacity(FAKE_FEED_NUMBER_TOTAL_MS)).toBe(1);
    // context only starts fading after the video number is done
    expect(FAKE_FEED_NUMBER.contextStartMs).toBeGreaterThanOrEqual(
      videos.startMs + videos.durationMs
    );
  });
});

describe('Fake Feed — card 4 entrance', () => {
  it('easeOutBack starts at 0, ends at 1, and overshoots (the pop)', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 5);
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
    const peak = Math.max(
      ...Array.from({ length: 21 }, (_, i) => easeOutBack(i / 20))
    );
    expect(peak).toBeGreaterThan(1);
  });

  it('numbers enter smaller-and-faded, then settle to full size', () => {
    expect(entranceOpacity(0)).toBe(0);
    expect(entranceScale(0)).toBeLessThan(1);
    expect(entranceOpacity(FAKE_FEED_NUMBER_TOTAL_MS)).toBe(1);
    expect(entranceScale(FAKE_FEED_NUMBER.entranceMs)).toBeCloseTo(1, 5);
  });
});

describe('Fake Feed — card 1 chevron cascade', () => {
  it('spreads the chevrons down the travel as a stream, not a stack', () => {
    // At one instant the chevrons sit at distinct heights (phase-offset),
    // so they read as a continuous downward stream.
    const ys = Array.from(
      { length: SCROLL_CASCADE_COUNT },
      (_, i) => cascadeChevron(0, i).translateY
    );
    expect(new Set(ys.map((y) => Math.round(y))).size).toBeGreaterThan(1);
  });

  it('each chevron rises (moves up) over its cycle', () => {
    // Points the thumb toward the swipe-up gesture, so translateY grows
    // more negative as the cycle advances.
    const a = cascadeChevron(0, 0);
    const b = cascadeChevron(SCROLL_CASCADE_CYCLE_MS * 0.4, 0);
    expect(b.translateY).toBeLessThan(a.translateY);
  });

  it('loops seamlessly — every chevron wraps to its start', () => {
    for (let i = 0; i < SCROLL_CASCADE_COUNT; i++) {
      const start = cascadeChevron(0, i);
      const wrap = cascadeChevron(SCROLL_CASCADE_CYCLE_MS, i);
      expect(wrap.translateY).toBeCloseTo(start.translateY, 5);
      expect(wrap.opacity).toBeCloseTo(start.opacity, 5);
    }
  });
});

describe('Fake Feed — card 6 slow-drag fill', () => {
  const D = 0.3; // a ~0.3 rad move, timed to span slow → fast

  it('a slow drag fills at full credit', () => {
    // 0.3 rad over 400ms = 0.75 rad/s, well under the slow ceiling.
    expect(fillGain(D, 400)).toBeCloseTo(D, 5);
    // direction does not matter — either way of turning fills
    expect(fillGain(-D, 400)).toBeCloseTo(D, 5);
  });

  it('a fast drag does NOT fill — it slips back a little', () => {
    // 0.3 rad over 20ms = 15 rad/s, well over the fast floor.
    const g = fillGain(D, 20);
    expect(g).toBeLessThan(0);
    expect(g).toBeGreaterThan(-0.2); // a nudge, not a reset
  });

  it('in between, credit scales down with speed (never punishing)', () => {
    const dt = (D / ((FILL_SLOW_MAX + FILL_FAST_MIN) / 2)) * 1000;
    const g = fillGain(D, dt);
    expect(g).toBeGreaterThan(0);
    expect(g).toBeLessThan(D); // less than full credit
  });

  it('needs more than one full turn of slow dragging to complete', () => {
    // So a single quick sweep around the ring cannot finish it.
    expect(FILL_TOTAL_RAD).toBeGreaterThan(2 * Math.PI);
  });

  it('completes only by accumulating slow moves', () => {
    let acc = 0;
    for (let i = 0; i < 40; i++) acc += fillGain(0.25, 300); // 40 slow steps
    expect(acc).toBeGreaterThanOrEqual(FILL_TOTAL_RAD);
  });
});
