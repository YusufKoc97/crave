/**
 * Fake Feed — card 4 ("the number"), count-up math.
 *
 * Kept pure and out of the component so the one thing that must be right
 * — the numbers land on their targets, in order, and decelerate rather
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
 * Card 4's timeline. Distance counts first, the video count follows once
 * it has settled, and the context lines fade in only after both numbers
 * have landed — so the figures hit before their meaning does.
 */
export const FAKE_FEED_NUMBER = {
  distance: { target: 90, startMs: 0, durationMs: 1700 } as CountUpSpec,
  videos: { target: 200, startMs: 2000, durationMs: 1700 } as CountUpSpec,
  /** When the context lines begin their fade — after both numbers land. */
  contextStartMs: 3900,
  /** How long the context fade takes. */
  contextFadeMs: 700,
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
