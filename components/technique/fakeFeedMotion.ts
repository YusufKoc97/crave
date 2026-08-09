/**
 * Fake Feed — the looping card animations (cards 1 and 6), as pure frame
 * math. Kept out of the component so the property that matters for each
 * — card 1 pulls the eye *down*, card 6 stays *slow* — is asserted in
 * tests, not merely intended. Every loop is seamless: the value at
 * `elapsed = 0` and at `elapsed = cycle` line up, so nothing jumps at
 * the wrap.
 *
 * These cards do NOT share the feed's blue: card 1 is a cool near-white
 * downward cascade, card 6 a serene teal breath. Each card owns its own
 * light rather than being tinted to match everything else.
 */

// ─── Card 1: downward chevron cascade ───

/** One chevron's trip down. Short, so the stream feels alive but calm. */
export const SCROLL_CASCADE_CYCLE_MS = 1500;
/** How many chevrons are in flight at once, evenly phased into a stream. */
export const SCROLL_CASCADE_COUNT = 4;
/** How far each chevron travels down over one cycle, in px. */
const SCROLL_CASCADE_TRAVEL = 96;

/**
 * State of chevron `index` at `elapsedMs`. The chevrons are phase-offset
 * by `index / count` so at any instant they are spread down the travel
 * as a continuous downward stream — a much stronger "keep going down"
 * than a single blip. Each fades in at the top and out toward the
 * bottom.
 */
export function cascadeChevron(
  elapsedMs: number,
  index: number
): { translateY: number; opacity: number } {
  const raw =
    elapsedMs / SCROLL_CASCADE_CYCLE_MS + index / SCROLL_CASCADE_COUNT;
  const p = ((raw % 1) + 1) % 1;
  const translateY = p * SCROLL_CASCADE_TRAVEL;
  let opacity: number;
  if (p < 0.15) opacity = p / 0.15;
  else if (p > 0.65) opacity = Math.max(0, (1 - p) / 0.35);
  else opacity = 1;
  return { translateY, opacity };
}

// ─── Card 6: slow pulse + expanding ripples ───

/**
 * The breath cycle. Deliberately long: the whole point is that it is far
 * slower than the scroll tempo, so watching it pulls the user off the
 * reflex. Speeding it up defeats the exercise — hence the floor and the
 * test that guards it.
 */
export const SLOW_PULSE_CYCLE_MS = 4500;
/** Floor the cycle must never drop below, or the pulse stops being calm. */
export const SLOW_PULSE_MIN_CYCLE_MS = 4000;

/**
 * Core state at `elapsedMs`: a smooth grow-and-brighten then
 * shrink-and-dim (raised cosine, eased at both ends, seamless loop).
 */
export function slowPulseFrame(elapsedMs: number): {
  scale: number;
  opacity: number;
  glow: number;
} {
  const p = (elapsedMs % SLOW_PULSE_CYCLE_MS) / SLOW_PULSE_CYCLE_MS;
  const s = (1 - Math.cos(2 * Math.PI * p)) / 2;
  return { scale: 0.82 + 0.34 * s, opacity: 0.25 + 0.4 * s, glow: s };
}

/** Static core for reduced-motion — a resting light, not a beat. */
export const SLOW_PULSE_REST = { scale: 1, opacity: 0.55, glow: 0.5 };

/** How many rings ripple outward at once, evenly phased. */
export const RIPPLE_COUNT = 3;
const RIPPLE_SCALE_MIN = 0.3;
const RIPPLE_SCALE_MAX = 1.4;

/**
 * Ring `index` at `elapsedMs`: expands from small to large on the same
 * slow breath, fading as it grows, so the pulse reads as calm ripples
 * spreading across the whole screen rather than a dot in a box.
 */
export function rippleRing(
  elapsedMs: number,
  index: number
): { scale: number; opacity: number } {
  const raw = elapsedMs / SLOW_PULSE_CYCLE_MS + index / RIPPLE_COUNT;
  const p = ((raw % 1) + 1) % 1;
  const scale = RIPPLE_SCALE_MIN + p * (RIPPLE_SCALE_MAX - RIPPLE_SCALE_MIN);
  const opacity = (1 - p) * 0.45;
  return { scale, opacity };
}
