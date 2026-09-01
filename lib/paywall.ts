import { router } from 'expo-router';

/**
 * Single entry point to the paywall screen.
 *
 * Every free-tier gate CTA (Triggers, Comparison, Streak Map), the
 * profile "Upgrade" row, and the add-addiction limit upsell call this
 * instead of hardcoding the route string — mirroring the single-source
 * discipline of `lib/premium.ts`. When the paywall route or name
 * changes, there is exactly one edit site.
 *
 * `source` rides along as a route param so the paywall (and future
 * analytics) can tell WHERE the user tapped from — e.g. tailor the
 * opening line to "you were looking at your triggers". It is optional
 * and today only recorded, never branched on.
 */
export type PaywallSource =
  | 'triggers'
  | 'comparison'
  | 'streak_map'
  | 'addiction_limit'
  | 'profile'
  | 'unknown';

export function openPaywall(source: PaywallSource = 'unknown') {
  router.push({ pathname: '/paywall', params: { source } });
}
