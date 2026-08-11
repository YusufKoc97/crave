/**
 * Fake Feed — card 1's cascade and card 6's drag mechanic, as pure math.
 * Kept out of the components so the properties that matter — card 1 pulls
 * the eye toward the swipe (up), card 6 only fills when the drag is slow —
 * are asserted in tests, not merely intended.
 */

// ─── Card 1: upward chevron cascade ───
//
// The gesture that advances a vertical paging feed is a swipe UP (the
// finger drags the next card up into view), so the invitation points UP,
// not down — a down-arrow was telling the thumb to go the wrong way.

/** One chevron's rise. Slow and smooth, not a nervous flicker. */
export const SCROLL_CASCADE_CYCLE_MS = 2400;
/** How many chevrons are in flight at once, evenly phased into a stream. */
export const SCROLL_CASCADE_COUNT = 3;
/** How far each chevron rises over one cycle, in px. */
const SCROLL_CASCADE_TRAVEL = 108;

/**
 * State of chevron `index` at `elapsedMs`. The chevrons are phase-offset
 * so at any instant they are spread up the travel as a continuous rising
 * stream. `translateY` is negative — they move UP, toward the swipe.
 * Opacity is a smooth sine (0 → 1 → 0), so each one eases in and out and
 * the loop has no visible seam.
 */
export function cascadeChevron(
  elapsedMs: number,
  index: number
): { translateY: number; opacity: number } {
  const raw =
    elapsedMs / SCROLL_CASCADE_CYCLE_MS + index / SCROLL_CASCADE_COUNT;
  const p = ((raw % 1) + 1) % 1;
  return {
    translateY: -p * SCROLL_CASCADE_TRAVEL,
    opacity: Math.sin(Math.PI * p),
  };
}

// ─── Card 6: slow-drag to fill ───
//
// The user drags a handle around a ring to fill it. The catch — the whole
// point of the card — is that only SLOW motion counts: drag fast and the
// fill stalls and even slips back a little, so the body has to brake the
// scroll reflex to make progress. "Slow down" is lived in the thumb, not
// just written on the screen.

/** Total angular distance of slow dragging needed to fill the ring — one
 *  full turn. At this ratio the fill tip tracks the finger 1:1 while the
 *  drag is slow (a longer target made the handle visibly trail the
 *  finger); a fast sweep still can't finish it, because {@link fillGain}
 *  refuses the credit, not because the ring is longer than a turn. */
export const FILL_TOTAL_RAD = Math.PI * 2;
/** At or under this angular speed (rad/s) the drag counts in full. */
export const FILL_SLOW_MAX = 2.5;
/** At or over this angular speed the drag is "too fast" — it slips back. */
export const FILL_FAST_MIN = 6;
/** Most a single fast move can undo — the penalty is a nudge, not a reset. */
const FILL_SLIP_MAX = 0.12;

/**
 * How much a drag move of `angleDeltaRad` over `dtMs` adds to the fill,
 * in radians. Slow → the full sweep counts. Fast → a gentle slip back.
 * In between → linearly scaled down. Never punishing, just insistent that
 * the motion be slow.
 */
export function fillGain(angleDeltaRad: number, dtMs: number): number {
  const dt = Math.max(dtMs, 1) / 1000;
  const mag = Math.abs(angleDeltaRad);
  const speed = mag / dt;
  if (speed <= FILL_SLOW_MAX) return mag;
  if (speed >= FILL_FAST_MIN) return -Math.min(mag, FILL_SLIP_MAX);
  const f = 1 - (speed - FILL_SLOW_MAX) / (FILL_FAST_MIN - FILL_SLOW_MAX);
  return mag * f;
}

/** Shortest signed angle from `a` to `b`, in (-π, π]. */
export function shortestAngle(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ─── Card 2: the reel-flick feed (design handoff) ───
//
// A phone-in-a-phone: blank reel frames flick past, one at a time,
// continuously UP (the current reel exits the top, the next rises from
// the bottom — the direction a real thumb-swipe scrolls), in a stepped,
// human rhythm rather than a linear crawl. Per the "Notice the pull."
// handoff.

/** Reel frames per copy (two identical copies are stacked for the loop). */
export const REEL_COUNT = 7;
/** Vertical pitch of one reel: 764 tall + 16 gap. */
export const REEL_PITCH = 780;
/** One flick's duration — snappy, so it "lands". */
export const FLICK_MS = 400;

/** Track offset after `step` flicks: each flick is one pitch further up. */
export function flickTarget(step: number): number {
  return -step * REEL_PITCH;
}

/**
 * The rest between flicks, in ms — skewed short with the occasional
 * linger so it feels like a human thumb, not a metronome. Random inputs
 * are passed in (0..1) so the shape is testable: mostly 120–1550ms, and
 * ~8% of the time a ~1.1s linger on top.
 */
export function flickPause(r1: number, r2: number, r3: number): number {
  let pause = r1 < 0.15 ? 120 : 300 + r2 * r2 * 1250;
  if (r3 < 0.08) pause += 1100;
  return pause;
}

/**
 * Cubic-bezier easing y(x) for control points (x1,y1,x2,y2). Newton-
 * solves x→t then reads y. Used for the flick's (0.16,0.84,0.26,1)
 * ease-out — the exact curve from the handoff.
 */
export function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xt = sampleX(t) - x;
      if (Math.abs(xt) < 1e-4) break;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= xt / d;
    }
    return sampleY(t);
  };
}

/** The flick easing itself (the handoff's exact bezier). */
export const flickEasing = cubicBezierEase(0.16, 0.84, 0.26, 1);

// ─── Card 3: notice your thumb ───
//
// The autopilot scroll gesture, drawn as a right-thumb swipe-up arc: a
// neon comet flows UP a curved track, led by a bright fingertip, with a
// contact ripple where the thumb "touches down". Then the dot fades and
// the whole thing resets invisibly — so the user only ever sees an UP
// swipe. From the "Notice your thumb." handoff; one calm 2.6s loop. The
// timing (dash-offset sweep, held tip, faded reset) is the handoff's.

/** One swipe-up of the thumb along its arc. Calm, unhurried. */
export const THUMB_CYCLE_MS = 2600;

/** Trail dash: a 120px lit comet, 520px gap, offset one 640 pattern. */
export const THUMB_TRAIL_DASH = 120;
export const THUMB_TRAIL_GAP = 520;
export const THUMB_TRAIL_LEN = THUMB_TRAIL_DASH + THUMB_TRAIL_GAP; // 640

/**
 * Evaluate a keyframed value at loop progress `p` (0..1): piecewise-linear
 * between `values` at `times`, eased per segment by `splines` (cubic-bezier
 * control points) when given. This is the one shape behind every channel of
 * the thumb loop, so the exact handoff timing is asserted, not just coded.
 */
function keyed(
  p: number,
  times: readonly number[],
  values: readonly number[],
  splines?: readonly (readonly [number, number, number, number])[]
): number {
  if (p <= times[0]) return values[0];
  for (let i = 0; i < times.length - 1; i++) {
    if (p <= times[i + 1]) {
      const span = times[i + 1] - times[i];
      const local = span <= 0 ? 0 : (p - times[i]) / span;
      const s = splines?.[i];
      const e = s ? cubicBezierEase(s[0], s[1], s[2], s[3])(local) : local;
      return values[i] + (values[i + 1] - values[i]) * e;
    }
  }
  return values[values.length - 1];
}

// The sweep's timeline: ease up (0→55%), hold at the top (55→72%), ease
// the invisible reset back down (72→100%). The middle spline is linear.
const THUMB_TIME = [0, 0.55, 0.72, 1] as const;
const THUMB_SPLINES = [
  [0.4, 0, 0.2, 1],
  [0, 0, 1, 1],
  [0.4, 0, 0.2, 1],
] as const;

export interface ThumbSwipe {
  /** strokeDashoffset of the comet trail — slides it up, then resets. */
  trailOffset: number;
  /** Head position 0..1 along the bezier arc (bottom → top). */
  dotT: number;
  /** Bright fingertip opacity — fades in low, out near the top. */
  dotOpacity: number;
  /** Contact-ripple radius at the start point. */
  pulseR: number;
  /** Contact-ripple opacity — one expand-and-vanish per loop. */
  pulseOpacity: number;
}

/**
 * The thumb loop's full state at `elapsedMs`. The comet and its lead dot
 * sweep up the arc over the first ~55%, hold briefly, then the dot fades
 * and everything resets invisibly (the loop never shows a down-swipe). A
 * ripple pings out where the thumb lands, at the very start of each loop.
 */
export function thumbSwipe(elapsedMs: number): ThumbSwipe {
  const p = (elapsedMs % THUMB_CYCLE_MS) / THUMB_CYCLE_MS;
  return {
    trailOffset: keyed(
      p,
      THUMB_TIME,
      [THUMB_TRAIL_LEN, 0, 0, THUMB_TRAIL_LEN],
      THUMB_SPLINES
    ),
    dotT: keyed(p, THUMB_TIME, [0, 1, 1, 0], THUMB_SPLINES),
    dotOpacity: keyed(p, [0, 0.08, 0.62, 0.72, 1], [0, 1, 1, 0, 0]),
    pulseR: keyed(p, [0, 0.12, 1], [6, 28, 28]),
    pulseOpacity: keyed(p, [0, 0.14, 1], [0.95, 0, 0]),
  };
}

/** Reduced-motion pose — the fingertip resting mid-arc, present but calm. */
export const THUMB_REST: ThumbSwipe = {
  trailOffset: THUMB_TRAIL_LEN * 0.5,
  dotT: 0.5,
  dotOpacity: 0.7,
  pulseR: 6,
  pulseOpacity: 0,
};

// ─── Card 7: hold to fade ───
//
// The user PRESSES AND HOLDS; while held, one progress value climbs at a
// fixed rate and everything reads off it — the ring's fill and the feed's
// remaining light are the same number, so they can never drift apart.
// Release and the progress slides back down (it doesn't just pause), so
// the card asks for one continuous pause, not pieces of one.

/** A full, uninterrupted hold: 6 seconds at constant rate. DESIGN
 *  DECISION — the six-second wait IS the exercise; do not tune. */
export const HOLD_FILL_MS = 6000;
/** How fast progress slides back once the finger lifts: 15% per second,
 *  all the way to zero. A backslide, not a reset — firm but not punitive. */
export const HOLD_DECAY_PER_S = 0.15;

/**
 * Advance card 7's single progress value by `dtMs`. Held → climbs at the
 * constant {@link HOLD_FILL_MS} rate; released → slides back at
 * {@link HOLD_DECAY_PER_S}. Clamped to [0, 1]. This is the ONE value the
 * ring fill, the feed's dimming and completion all read — sync by
 * construction.
 */
export function holdStep(
  progress: number,
  dtMs: number,
  holding: boolean
): number {
  const dt = Math.max(0, dtMs);
  const next = holding
    ? progress + dt / HOLD_FILL_MS
    : progress - (HOLD_DECAY_PER_S * dt) / 1000;
  return Math.max(0, Math.min(1, next));
}

// ─── Cards 6 & 7: the shared escape hatch ───

/** How long an interactive card sits centred before a faint "Skip"
 *  appears. One constant for BOTH card 6 and card 7 — the escape is the
 *  same pattern in the same place at the same time, deliberately. */
export const SKIP_AFTER_MS = 20_000;

// ─── Card 5: the deliberate emptiness ───

/** How long the card holds as pure emptiness before the line appears —
 *  long enough to feel the silence, not so long it reads as a bug. */
export const EMPTY_REVEAL_MS = 3400;
/** How slowly the confirming line fades in once the emptiness has sat. */
export const EMPTY_FADE_MS = 2400;

/**
 * Opacity (0..1) of card 5's one faint line at `elapsedMs`: nothing at
 * all until {@link EMPTY_REVEAL_MS} has passed (real emptiness first),
 * then a very slow fade so it confirms the void is intentional rather
 * than announcing itself.
 */
export function emptyLineOpacity(elapsedMs: number): number {
  const t = (elapsedMs - EMPTY_REVEAL_MS) / EMPTY_FADE_MS;
  return Math.max(0, Math.min(1, t));
}
