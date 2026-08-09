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

// ─── Card 2: the collective scroll flow ───

/** Upward speed of the blurred content ghosts — fast, the doomscroll
 *  tempo seen from outside. px per second. */
export const GHOST_FLOW_SPEED = 340;

/**
 * Vertical offset (0..total) of ghost `index` at `elapsedMs`, scrolling
 * up and wrapping seamlessly, where `total = spacing * count`. The strip
 * of ghosts reads as an endless fast feed with no beginning or end.
 */
export function ghostY(
  elapsedMs: number,
  index: number,
  spacing: number,
  count: number
): number {
  const total = spacing * count;
  const raw = index * spacing - (elapsedMs / 1000) * GHOST_FLOW_SPEED;
  return ((raw % total) + total) % total;
}

// ─── Card 3: notice your thumb ───

/** One swipe-up of the thumb along its arc. Calm, unhurried. */
export const THUMB_CYCLE_MS = 2000;

/**
 * The thumb's progress along its curved track at `elapsedMs`. `t` runs
 * 0 → 1 = bottom → top (a swipe UP, the gesture that actually advances
 * the feed); the component maps `t` onto a right-thumb bezier arc.
 * Opacity is a smooth sine (0 at both ends) so it fades in low on the
 * arc, brightens through the sweep and fades out at the top, and the
 * loop is seamless. NOT a literal thumb — the component draws a soft
 * fingertip; this only paces it.
 */
export function thumbArc(elapsedMs: number): {
  t: number;
  opacity: number;
  scale: number;
} {
  const t = (elapsedMs % THUMB_CYCLE_MS) / THUMB_CYCLE_MS;
  const s = Math.sin(Math.PI * t);
  return { t, opacity: s, scale: 0.9 + 0.14 * s };
}

/** Still thumb for reduced-motion — mid-arc, present but calm. */
export const THUMB_REST = thumbArc(THUMB_CYCLE_MS / 2);

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
