/**
 * Fake Feed — the two looping card animations (cards 1 and 6), as pure
 * frame math.
 *
 * Kept out of the component so the property that actually matters for
 * each — card 1's invitation reads as a calm downward pull, card 6's
 * pulse stays *slow* — is asserted in tests, not just intended. Both are
 * continuous, seamless loops: `frame(0)` and `frame(cycle)` line up so
 * there is no visible jump at the wrap.
 */

// ─── Card 1: scroll invitation ───

/** One drift-and-fade of the chevron. Calm, not urgent. */
export const SCROLL_INVITE_CYCLE_MS = 1700;

/** How far the chevron drifts down over one cycle, in px. */
const SCROLL_INVITE_DRIFT = 18;

/**
 * Chevron state at `elapsedMs`: drifts from 0 to {@link
 * SCROLL_INVITE_DRIFT} down while fading — quick fade-in, longer
 * fade-out — so it reads as a gentle "keep going down", looping.
 */
export function scrollInviteFrame(elapsedMs: number): {
  translateY: number;
  opacity: number;
} {
  const p = (elapsedMs % SCROLL_INVITE_CYCLE_MS) / SCROLL_INVITE_CYCLE_MS;
  const translateY = p * SCROLL_INVITE_DRIFT;
  const opacity = p < 0.2 ? p / 0.2 : Math.max(0, 1 - (p - 0.2) / 0.8);
  return { translateY, opacity };
}

/** Static chevron for reduced-motion — present, but not moving. */
export const SCROLL_INVITE_REST = { translateY: 6, opacity: 0.6 };

// ─── Card 6: slow pulse ───

/**
 * The breath cycle of the pulse. Deliberately long: the whole point is
 * that it is far slower than the user's scroll tempo, so watching it
 * pulls them off the reflex. Speeding this up defeats the exercise —
 * hence {@link SLOW_PULSE_MIN_CYCLE_MS} and the test that guards it.
 */
export const SLOW_PULSE_CYCLE_MS = 4500;

/** Floor the cycle must never drop below, or the pulse stops being calm. */
export const SLOW_PULSE_MIN_CYCLE_MS = 4000;

/**
 * Pulse state at `elapsedMs`: a smooth grow-and-brighten then
 * shrink-and-dim over one cycle (raised cosine, so it eases at both
 * ends and loops seamlessly). `glow` is the same 0..1 curve, for any
 * layer that wants to track the breath.
 */
export function slowPulseFrame(elapsedMs: number): {
  scale: number;
  opacity: number;
  glow: number;
} {
  const p = (elapsedMs % SLOW_PULSE_CYCLE_MS) / SLOW_PULSE_CYCLE_MS;
  const s = (1 - Math.cos(2 * Math.PI * p)) / 2; // 0 → 1 → 0, eased
  return { scale: 0.82 + 0.34 * s, opacity: 0.22 + 0.4 * s, glow: s };
}

/** Static soft glow for reduced-motion — a resting light, not a beat. */
export const SLOW_PULSE_REST = { scale: 1, opacity: 0.5, glow: 0.5 };
