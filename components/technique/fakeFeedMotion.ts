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
