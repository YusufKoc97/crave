import { QueryClient } from '@tanstack/react-query';
import { TRIGGER_MAP_STALE_MS } from '@/constants/heatmap';

/**
 * App-wide React Query client. Kept as a singleton so cache
 * invalidations from anywhere (e.g. active-session after a
 * resolve) hit the same instance the Info tab is reading.
 *
 * Defaults tuned for our surfaces:
 *   staleTime = TRIGGER_MAP_STALE_MS — Faz 8a's 5-minute freshness
 *                                       window. Other queries can
 *                                       override on a per-hook basis.
 *   retry = 1                        — one silent retry is enough
 *                                       for the flaky-network case;
 *                                       more just makes errors slow.
 *   refetchOnWindowFocus = false     — we're on native + web PWA,
 *                                       both of which fire focus in
 *                                       ways that would spam the
 *                                       Edge Function.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: TRIGGER_MAP_STALE_MS,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Central invalidation entry point. Callers (e.g. active-session
 * after resolve-craving lands) invoke this instead of hardcoding
 * queryKey strings across the app.
 */
export function invalidateTriggerMaps(): void {
  queryClient.invalidateQueries({ queryKey: ['trigger-map'] });
}
