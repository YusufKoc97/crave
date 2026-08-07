/**
 * Fake Feed — card 4 ("the number"), count-up math.
 *
 * Kept pure and out of the component so the one thing that must be right
 * — the numbers land on their targets, together, and decelerate rather
 * than crawl — is testable without a running frame loop.
 *
 * The two figures are deliberately *approximate* (each is rendered with
 * a "~"). They are order-of-magnitude, widely-circulated stats, not
 * precise measurements:
 *
 *   • distance ≈ 90 m/day — the much-repeated "you scroll the height of
 *     the Statue of Liberty (~93 m) every day" figure from phone-usage
 *     infographics. Illustrative, not a hard constant.
 *   • videos ≈ 200/day — a derived estimate: roughly an hour a day in
 *     short-video feeds (Reels/TikTok/Shorts usage is commonly reported
 *     around 45–60+ min) at ~15–20 s per heavily-skipped clip lands in
 *     the ~150–250 range; 200 is a round midpoint.
 *
 * The lifetime-scale context lines follow from these: ~90 m ≈ the Statue
 * of Liberty; ~1 h/day of feed ≈ 365 h/yr ≈ ~15 days a year.
 */

export type CountUpSpec = {
  /** Final value the number lands on. */
  target: number;
  /** ms from the sequence start at which THIS number begins counting. */
  startMs: number;
  /** ms this number spends counting from 0 to target. */
  durationMs: number;
};

/**
 * Card 4's timeline. Both numbers count together, from the instant the
 * card lands, so the pair hits as one striking beat rather than a slow
 * relay; the context lines fade in only once both have settled, so the
 * figures land before their meaning does.
 */
export const FAKE_FEED_NUMBER = {
  distance: { target: 90, startMs: 0, durationMs: 1800 } as CountUpSpec,
  videos: { target: 200, startMs: 0, durationMs: 1800 } as CountUpSpec,
  /** How long the numbers take to enter (scale + fade pop). */
  entranceMs: 420,
  /** When the context lines begin their fade — after both numbers land. */
  contextStartMs: 1950,
  /** How long the context fade takes. */
  contextFadeMs: 650,
} as const;

/** The moment the whole sequence is finished (last pixel settled). */
export const FAKE_FEED_NUMBER_TOTAL_MS =
  FAKE_FEED_NUMBER.contextStartMs + FAKE_FEED_NUMBER.contextFadeMs;

/**
 * Ease-out cubic: fast off the mark, decelerating to a soft stop, so the
 * number visibly *arrives* rather than ticking to a halt at constant
 * speed. t is clamped to [0, 1] by the callers below.
 */
export function easeOutCubic(t: number): number {
  const c = 1 - t;
  return 1 - c * c * c;
}

/**
 * Ease-out-back: overshoots past 1 near the end and settles back to
 * exactly 1, so the numbers enter with a small pop rather than easing in
 * flatly. easeOutBack(0) === 0 and easeOutBack(1) === 1.
 */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

/**
 * Entrance scale at `elapsedMs`: grows from 0.7 to 1 (with the
 * easeOutBack pop) over {@link FAKE_FEED_NUMBER.entranceMs}, then holds
 * at 1. Paired with {@link entranceOpacity} to make the numbers arrive.
 */
export function entranceScale(elapsedMs: number): number {
  const t = Math.min(1, Math.max(0, elapsedMs / FAKE_FEED_NUMBER.entranceMs));
  return 0.7 + 0.3 * easeOutBack(t);
}

/** Entrance opacity — a quick linear fade so the numbers are up fast. */
export function entranceOpacity(elapsedMs: number): number {
  return Math.min(
    1,
    Math.max(0, elapsedMs / (FAKE_FEED_NUMBER.entranceMs * 0.6))
  );
}

/**
 * Value of a single count-up at `elapsedMs` into the sequence. Zero
 * before its `startMs` (it has not begun), exactly `target` at and after
 * `startMs + durationMs`. Never overshoots.
 */
export function countUpValue(elapsedMs: number, spec: CountUpSpec): number {
  if (elapsedMs <= spec.startMs) return 0;
  const t = Math.min(1, (elapsedMs - spec.startMs) / spec.durationMs);
  return spec.target * easeOutCubic(t);
}

/**
 * Context-line opacity at `elapsedMs`, 0..1 — 0 until the numbers have
 * landed, then a linear fade to fully visible.
 */
export function contextOpacity(elapsedMs: number): number {
  const t =
    (elapsedMs - FAKE_FEED_NUMBER.contextStartMs) /
    FAKE_FEED_NUMBER.contextFadeMs;
  return Math.max(0, Math.min(1, t));
}
