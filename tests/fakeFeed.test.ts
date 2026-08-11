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
  EMPTY_REVEAL_MS,
  FILL_FAST_MIN,
  FILL_SLOW_MAX,
  FILL_TOTAL_RAD,
  REEL_COUNT,
  REEL_PITCH,
  BOTTOM_REVEAL_MS,
  END_HOLD_MS,
  END_TEXT_FADE_MS,
  HOLD_DECAY_PER_S,
  HOLD_FILL_MS,
  SCROLL_CASCADE_COUNT,
  SCROLL_CASCADE_CYCLE_MS,
  SHIVER_MS,
  SKIP_AFTER_MS,
  THUMB_CYCLE_MS,
  THUMB_TRAIL_LEN,
  WIND_DOWN_MS,
  bottomMsgOpacity,
  cascadeChevron,
  emptyLineOpacity,
  endTextOpacity,
  fillGain,
  flickEasing,
  flickPause,
  flickTarget,
  holdStep,
  shiverOffset,
  thumbSwipe,
  windDownDrain,
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

  it('takes a full turn of slow dragging to complete (fill tracks the finger 1:1)', () => {
    // One full turn — so at slow speed the fill tip stays under the
    // finger. A quick sweep still cannot finish it (fillGain refuses the
    // credit); that is asserted by the fast/slow tests, not the length.
    expect(FILL_TOTAL_RAD).toBeCloseTo(2 * Math.PI, 5);
  });

  it('completes only by accumulating slow moves', () => {
    let acc = 0;
    for (let i = 0; i < 40; i++) acc += fillGain(0.25, 300); // 40 slow steps
    expect(acc).toBeGreaterThanOrEqual(FILL_TOTAL_RAD);
  });
});

describe('Fake Feed — card 2 reel flick', () => {
  it('each flick steps the track one pitch further UP', () => {
    expect(flickTarget(0)).toBeCloseTo(0, 5);
    expect(flickTarget(1)).toBe(-REEL_PITCH);
    expect(flickTarget(3)).toBe(-3 * REEL_PITCH);
    // strictly decreasing (always upward, never the reverse)
    for (let s = 1; s <= REEL_COUNT; s++) {
      expect(flickTarget(s)).toBeLessThan(flickTarget(s - 1));
    }
  });

  it('the seamless-wrap frame sits exactly one copy above the start', () => {
    // step REEL_COUNT is copy-2 frame 0, pixel-identical to copy-1 frame
    // 0 (step 0) one copy down — so snapping back shows no jump.
    expect(flickTarget(REEL_COUNT)).toBe(-REEL_COUNT * REEL_PITCH);
    expect(flickTarget(REEL_COUNT) % REEL_PITCH).toBeCloseTo(0, 5);
  });

  it('rests a human amount — short mostly, sometimes a linger', () => {
    expect(flickPause(0.05, 0, 0.5)).toBe(120); // quick tap
    const typical = flickPause(0.5, 0.5, 0.5); // 300 + 0.25*1250
    expect(typical).toBeGreaterThan(120);
    expect(typical).toBeLessThan(1600);
    expect(flickPause(0.5, 0.99, 0.01)).toBeGreaterThan(1600); // linger added
  });

  it('the flick easing is a real ease (0→1, front-loaded)', () => {
    expect(flickEasing(0)).toBe(0);
    expect(flickEasing(1)).toBe(1);
    // ease-out: already past halfway at the time-midpoint
    expect(flickEasing(0.5)).toBeGreaterThan(0.5);
  });
});

describe('Fake Feed — card 3 notice your thumb', () => {
  it('sweeps the comet UP the arc (bottom → top) over the first ~55%', () => {
    expect(thumbSwipe(0).dotT).toBeCloseTo(0, 5); // starts at the bottom
    expect(thumbSwipe(THUMB_CYCLE_MS * 0.55).dotT).toBeCloseTo(1, 5); // top
    const mid = thumbSwipe(THUMB_CYCLE_MS * 0.28).dotT;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('only ever shows an up-swipe: the tip is invisible during the reset', () => {
    expect(thumbSwipe(0).dotOpacity).toBeCloseTo(0, 5); // fades in from off
    expect(thumbSwipe(THUMB_CYCLE_MS * 0.3).dotOpacity).toBeGreaterThan(0.9);
    // 72%→100% is the invisible reset back to the bottom.
    expect(thumbSwipe(THUMB_CYCLE_MS * 0.85).dotOpacity).toBe(0);
  });

  it('slides the trail up then holds it at the top before resetting', () => {
    expect(thumbSwipe(0).trailOffset).toBeCloseTo(THUMB_TRAIL_LEN, 5);
    expect(thumbSwipe(THUMB_CYCLE_MS * 0.55).trailOffset).toBeCloseTo(0, 5);
    expect(thumbSwipe(THUMB_CYCLE_MS * 0.63).trailOffset).toBeCloseTo(0, 5); // held
  });

  it('pings a contact ripple that expands and fades at the start of each loop', () => {
    expect(thumbSwipe(0).pulseOpacity).toBeGreaterThan(0.9);
    expect(thumbSwipe(0).pulseR).toBeLessThan(10); // small on contact
    expect(thumbSwipe(THUMB_CYCLE_MS * 0.12).pulseR).toBeCloseTo(28, 5); // expanded
    expect(thumbSwipe(THUMB_CYCLE_MS * 0.5).pulseOpacity).toBe(0); // gone
  });

  it('loops seamlessly (one full cycle returns to the start)', () => {
    expect(thumbSwipe(THUMB_CYCLE_MS).dotT).toBeCloseTo(0, 5);
    expect(thumbSwipe(THUMB_CYCLE_MS).trailOffset).toBeCloseTo(
      THUMB_TRAIL_LEN,
      5
    );
  });
});

describe('Fake Feed — card 7 hold to fade', () => {
  it('a full, uninterrupted hold takes exactly 6 seconds', () => {
    expect(HOLD_FILL_MS).toBe(6000); // fixed design decision
    expect(holdStep(0, HOLD_FILL_MS, true)).toBe(1);
    expect(holdStep(0, HOLD_FILL_MS - 1, true)).toBeLessThan(1);
  });

  it('fills at a constant rate while held', () => {
    expect(holdStep(0, 1500, true)).toBeCloseTo(0.25, 5);
    expect(holdStep(0.25, 1500, true)).toBeCloseTo(0.5, 5);
    // Same dt adds the same amount anywhere on the ramp — no easing.
    const a = holdStep(0.1, 600, true) - 0.1;
    const b = holdStep(0.8, 600, true) - 0.8;
    expect(a).toBeCloseTo(b, 10);
  });

  it('slides back at 15%/s on release, all the way to zero', () => {
    expect(HOLD_DECAY_PER_S).toBe(0.15);
    expect(holdStep(1, 1000, false)).toBeCloseTo(0.85, 5);
    expect(holdStep(0.5, 2000, false)).toBeCloseTo(0.2, 5);
    expect(holdStep(0.1, 1000, false)).toBe(0); // clamps at empty
  });

  it('clamps at full and never overshoots', () => {
    expect(holdStep(0.9, 60_000, true)).toBe(1);
    expect(holdStep(0, 60_000, false)).toBe(0);
  });

  it('holding outpaces the backslide, so persistence always wins', () => {
    const fillPerS = 1000 / HOLD_FILL_MS;
    expect(fillPerS).toBeGreaterThan(HOLD_DECAY_PER_S);
  });

  it('shares one 20s Skip timing with card 6', () => {
    expect(SKIP_AFTER_MS).toBe(20_000);
  });
});

describe('Fake Feed — card 8 winding down', () => {
  it('drains from full to spent over the wind-down window', () => {
    expect(windDownDrain(0)).toBeCloseTo(0, 5);
    expect(windDownDrain(WIND_DOWN_MS)).toBeCloseTo(1, 5);
    expect(windDownDrain(-500)).toBe(0); // clamps before arrival
    expect(windDownDrain(WIND_DOWN_MS * 5)).toBe(1); // clamps after
  });

  it('eases (settles) rather than bleeding out linearly', () => {
    const mid = windDownDrain(WIND_DOWN_MS / 2);
    expect(mid).toBeCloseTo(0.5, 5); // symmetric ease-in-out at the midpoint
    // Slow at the very start (ease-in): less than a linear ramp would give.
    expect(windDownDrain(WIND_DOWN_MS * 0.1)).toBeLessThan(0.1);
  });
});

describe('Fake Feed — card 9 the bottom', () => {
  it('flinches then settles — the shiver decays to nothing', () => {
    expect(shiverOffset(0)).toBe(0);
    expect(shiverOffset(SHIVER_MS)).toBe(0);
    expect(shiverOffset(-10)).toBe(0);
    expect(Math.abs(shiverOffset(SHIVER_MS * 0.1))).toBeGreaterThan(0); // moving early
    // Amplitude decays: a late peak is smaller than an early one.
    const early = Math.abs(shiverOffset(SHIVER_MS * 0.08));
    const late = Math.abs(shiverOffset(SHIVER_MS * 0.92));
    expect(late).toBeLessThan(early);
  });

  it('fades the bottom line in softly, then holds it', () => {
    expect(bottomMsgOpacity(0)).toBe(0);
    expect(bottomMsgOpacity(450)).toBeGreaterThan(0);
    expect(bottomMsgOpacity(450)).toBeLessThan(1);
    expect(bottomMsgOpacity(2000)).toBe(1);
  });

  it('speaks within a few seconds even with no swipes', () => {
    expect(BOTTOM_REVEAL_MS).toBeLessThanOrEqual(3000);
  });
});

describe('Fake Feed — card 10 the end', () => {
  it('fades the closing line to FULL, readable opacity (not a ghostly half)', () => {
    expect(endTextOpacity(0)).toBe(0);
    expect(endTextOpacity(END_TEXT_FADE_MS)).toBe(1);
    expect(endTextOpacity(END_TEXT_FADE_MS * 10)).toBe(1); // stays fully lit
  });

  it('holds long enough to read the lesson before auto-completing', () => {
    expect(END_HOLD_MS).toBeGreaterThanOrEqual(END_TEXT_FADE_MS);
    expect(END_HOLD_MS).toBe(4000);
  });
});

describe('Fake Feed — card 5 deliberate emptiness', () => {
  it('shows nothing until the emptiness has been felt', () => {
    expect(emptyLineOpacity(0)).toBe(0);
    expect(emptyLineOpacity(EMPTY_REVEAL_MS - 1)).toBe(0);
    expect(emptyLineOpacity(EMPTY_REVEAL_MS)).toBe(0);
  });

  it('then fades the line in, slowly, to full', () => {
    const justAfter = emptyLineOpacity(EMPTY_REVEAL_MS + 300);
    expect(justAfter).toBeGreaterThan(0);
    expect(justAfter).toBeLessThan(1); // slow — not instant
    expect(emptyLineOpacity(EMPTY_REVEAL_MS + 10_000)).toBe(1);
  });
});
