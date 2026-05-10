/**
 * Dev-only switch that skips the auth + username gates so the orb screen
 * is reachable without a live Supabase session. Useful when iterating on
 * UI in environments where the backend is paused / unreachable.
 *
 * Double-guarded:
 *   - `__DEV__` is true in development bundles, false in production. Even
 *     if EXPO_PUBLIC_DEV_SKIP_AUTH leaks into a prod env, the bypass is
 *     compiled out.
 *   - Has to be the literal string '1' — accidental truthy values
 *     ('true', 'yes') won't enable it.
 *
 * Set in .env.local to enable:
 *   EXPO_PUBLIC_DEV_SKIP_AUTH=1
 */
export const DEV_SKIP_AUTH =
  __DEV__ && process.env.EXPO_PUBLIC_DEV_SKIP_AUTH === '1';
