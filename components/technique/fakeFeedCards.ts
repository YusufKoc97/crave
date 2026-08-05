/**
 * Fake Feed — the finite card list.
 *
 * Exactly ten cards, in a deliberate emotional descent: invitation →
 * recognition → noticing → confrontation → slowing → depletion → end.
 * **The order is the exercise.** Reordering, adding or removing a card
 * changes what it teaches, so the list lives here as one fixed array
 * rather than being assembled at render time.
 *
 * Skeleton scope: each card is text only (`key` resolves to
 * `toolkit.techniques.fake_feed.cards.<key>`). The richer per-card
 * treatments (count-up, thumb silhouette, hold gesture, blur) land in
 * later briefs and will attach to these same keys.
 */

export type FakeFeedCard = {
  /** i18n leaf under `toolkit.techniques.fake_feed.cards`. */
  key: string;
  /**
   * How depleted this card reads, 0..1. Drives a downward fade over
   * the closing cards so the feed visibly runs out of energy rather
   * than stopping abruptly — the "DEPLETES" guardrail. Kept as data,
   * not a computed tail, so tuning a single card never shifts the
   * others.
   */
  depletion?: number;
};

export const FAKE_FEED_CARDS: readonly FakeFeedCard[] = [
  { key: 'invitation' }, // 1 — prompt to scroll
  { key: 'speed_mirror' }, // 2 — "This is you, most nights."
  { key: 'thumb' }, // 3 — notice your thumb
  { key: 'number' }, // 4 — the distance stat
  { key: 'empty_search' }, // 5 — what were you looking for?
  { key: 'slow_pulse' }, // 6 — slow down with this
  { key: 'hold' }, // 7 — hold to pause
  { key: 'winding_down', depletion: 0.35 }, // 8 — running out
  { key: 'bottom', depletion: 0.6 }, // 9 — the bottom
  { key: 'end', depletion: 0.85 }, // 10 — put the phone down
] as const;

export const FAKE_FEED_CARD_COUNT = FAKE_FEED_CARDS.length;

/**
 * Index of the first card that reads as depleted — the beat where the
 * feed starts winding down. Used for the single depletion haptic.
 */
export const FAKE_FEED_DEPLETION_START = FAKE_FEED_CARDS.findIndex(
  (card) => card.depletion != null
);

export type FeedStep =
  /** Nothing to do yet — the current card still owes screen time. */
  | { kind: 'wait' }
  /** The next card has earned its place in the feed. */
  | { kind: 'unlock'; unlocked: number }
  /** The last card has been served: the feed is out of content. */
  | { kind: 'complete' };

/**
 * The pace guard, as a pure decision.
 *
 * Kept out of the component so the guardrails are testable rather than
 * merely intended: a feed that quietly unlocked an eleventh card, or
 * completed early, or let a fast scroller outrun the dwell, would be
 * the exact failure this exercise is supposed to avoid — it would turn
 * back into the thing it treats.
 *
 * - `index`    which card is on screen (0-based)
 * - `unlocked` how many cards currently exist in the feed
 * - `dwellMs`  foreground time the current card has held the screen
 * - `requiredMs` minimum before the next card may appear
 */
export function feedStep({
  index,
  unlocked,
  dwellMs,
  requiredMs,
}: {
  index: number;
  unlocked: number;
  dwellMs: number;
  requiredMs: number;
}): FeedStep {
  if (dwellMs < requiredMs) return { kind: 'wait' };
  // Last card served → the feed ends. Never loops, never refills.
  if (index >= FAKE_FEED_CARD_COUNT - 1) return { kind: 'complete' };
  // Only ever extend the feed by one, and only from its current tip —
  // so scrolling back to an earlier card can't unlock anything, and a
  // slow tick can't skip a card.
  if (unlocked === index + 1) {
    return { kind: 'unlock', unlocked: unlocked + 1 };
  }
  return { kind: 'wait' };
}
