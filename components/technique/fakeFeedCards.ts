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
