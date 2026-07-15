/**
 * App-wide premium flag. Kept as a single source so every gate —
 * addiction limit (Faz 2), trigger heatmap free-tier blur (Faz 8),
 * and the eventual paywall (Faz X) — reads from one place.
 *
 * Today the flag is hardcoded `false`. When the paywall ships it
 * becomes a hook backed by RevenueCat / user profile; every
 * consumer using `useIsPremium()` picks up the change with no
 * further edits.
 *
 * Do NOT read `IS_PREMIUM` directly from screens — always go
 * through the hook. That keeps the "swap to real subscription
 * check" migration a one-liner.
 */

const IS_PREMIUM = false;

export function useIsPremium(): boolean {
  return IS_PREMIUM;
}

// Free / premium ceiling helpers stay in constants/addictions.ts
// (FREE_ACTIVE_LIMIT / PREMIUM_ACTIVE_LIMIT) — this file owns the
// flag itself, not the tier-specific numbers.
