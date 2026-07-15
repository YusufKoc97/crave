/**
 * Faz 7 — Live presence counter tuning knobs.
 *
 * Kept as a standalone constants file so the numbers stay easy to
 * revisit after real usage data. The values below are calibrated
 * for a small early-user population — expect to loosen them as
 * traffic grows.
 */

/**
 * Below this cutoff we hide the exact number and show a generic
 * "you're among those resisting" label. Reasons:
 *   - Guards against a demoralising "0 people resisting" empty
 *     state when the app is new.
 *   - Avoids revealing that only 2–3 others exist, which reads as
 *     "this product is empty".
 */
export const PRESENCE_MIN_THRESHOLD = 5;

/** How often the client re-queries the count while the active
 *  session screen is mounted AND in the foreground. */
export const PRESENCE_POLL_INTERVAL_MS = 10_000;

/**
 * Sessions older than this are excluded from the count — filters
 * abandoned rows left by force-quits or crashes without a resolve.
 * The Edge Function enforces the same cutoff server-side.
 */
export const PRESENCE_ACTIVE_WINDOW_MINUTES = 120;
