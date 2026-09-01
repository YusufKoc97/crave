import { useAuth } from '@/context/AuthContext';

/**
 * App-wide premium gate. Single source every client gate reads —
 * addiction limit (Faz 2), trigger heatmap free-tier blur (Faz 8),
 * the paywall's own gates, and the Streak Map history window.
 *
 * It now reflects the SERVER-TRUTH entitlement `profiles.is_premium`,
 * surfaced by AuthContext (fetched at the topmost provider so every
 * consumer — including AddictionsProvider, which sits above
 * SessionsProvider — sees one value). Until the RevenueCat webhook is
 * wired, that column is set out-of-band: manually for testing today,
 * by the webhook once billing ships. The purchase flow itself calls
 * `refreshPremium()` (AuthContext) after a successful buy/restore.
 *
 * DO NOT read entitlement any other way from screens — always go
 * through this hook, so the "swap to the real subscription check"
 * migration stayed the one-liner it was designed to be.
 */

// DEV-only visual preview: flip to `true` to see every premium surface
// unlocked in the simulator WITHOUT a signed-in premium user (seed mode
// has no real session). Compiled out of production by __DEV__.
const DEV_FORCE_PREMIUM = __DEV__ && false;

export function useIsPremium(): boolean {
  const { isPremium } = useAuth();
  if (DEV_FORCE_PREMIUM) return true;
  return isPremium;
}
