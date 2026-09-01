/**
 * Paywall pricing — single source of truth for what each plan costs.
 *
 * ⚠️ THESE ARE PLACEHOLDER VALUES that MIRROR the products we define in
 * App Store Connect. They are NOT fetched live. Fetching the real,
 * localized store prices requires StoreKit / RevenueCat, which needs a
 * native dev build (StoreKit is unavailable in Expo Go) and lands in the
 * billing milestone. When it does, replace the body of `usePaywallPlans`
 * with the product fetch — the paywall screen reads ONLY from this hook,
 * so nothing in the UI changes. Keep these numbers in sync with App
 * Store Connect until the live fetch takes over.
 *
 * Format follows what StoreKit returns for the tr_TR storefront (₺,
 * comma decimals). Once live, StoreKit localizes per the viewer's own
 * storefront automatically — the ₺ hardcoding here is only the stand-in.
 */

export type PlanId = 'annual' | 'monthly';

export type PlanDisplay = {
  id: PlanId;
  /** Full display price incl. period, e.g. "₺699,99/yr" — StoreKit's
   *  `displayPrice` + unit will slot in here unchanged. */
  priceLine: string;
  /** Secondary line under the price. null → the screen falls back to the
   *  "billed monthly" label. */
  subNote: string | null;
  /** Free-trial length in days (0 = no trial). Annual carries the trial. */
  trialDays: number;
  /** Marks the recommended plan (BEST VALUE badge + default selection). */
  best: boolean;
};

// Mirror of App Store Connect. ₺699,99/yr ≈ ₺58,33/mo; ₺149,99/mo.
const PLACEHOLDER_PLANS: PlanDisplay[] = [
  {
    id: 'annual',
    priceLine: '₺699,99/yr',
    subNote: '≈ ₺58,33 / month',
    trialDays: 7,
    best: true,
  },
  {
    id: 'monthly',
    priceLine: '₺149,99/mo',
    subNote: null,
    trialDays: 0,
    best: false,
  },
];

/**
 * Returns the plans to render in the paywall. Today a static placeholder;
 * swap the body for the StoreKit / RevenueCat product fetch when billing
 * is wired (this stays the paywall's only pricing dependency).
 */
export function usePaywallPlans(): PlanDisplay[] {
  return PLACEHOLDER_PLANS;
}

/** The plan selected by default when the paywall opens (the recommended
 *  one — Annual). Derived so the default can never drift from `best`. */
export function defaultPlanId(): PlanId {
  return (PLACEHOLDER_PLANS.find((p) => p.best) ?? PLACEHOLDER_PLANS[0]).id;
}
