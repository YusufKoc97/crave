import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from '@/context/AuthContext';
import type { ComparisonStatsResult } from '@/shared/comparisonStats';

/**
 * Modül 4 — client hook for the `comparison-data` Edge Function.
 *
 * The response type is imported straight from the shared aggregation
 * module the Edge Function also runs (`shared/comparisonStats.ts`), so
 * client and server can never drift on the wire shape — if the module
 * changes, TS breaks here too.
 *
 * This is the RAW aggregate (ids + numbers). Turning it into the
 * render-ready `ComparisonData` (labels, icons, formatted deltas,
 * ticker copy) is the mapper's job — see `mapResult.ts`.
 */

export type ComparisonResponse = ComparisonStatsResult;

async function fetchComparison(
  addictionId: string
): Promise<ComparisonResponse> {
  const { data, error } = await supabase.functions.invoke('comparison-data', {
    body: { addiction_id: addictionId },
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('comparison_unexpected_response');
  }
  return data as ComparisonResponse;
}

/**
 * React Query hook — cache-keyed by (userId, addictionId). Mirrors
 * `useTriggerMap`: namespaced by user id so a sign-out/sign-in can't
 * serve the previous user's standing from the singleton cache, gated
 * on `!!user` (the function is JWT-only), and `retry: 1` so an
 * unreachable function on the Info tab doesn't spin forever.
 */
export function useComparison(addictionId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['comparison', user?.id ?? 'anon', addictionId],
    queryFn: () => fetchComparison(addictionId),
    enabled: !!user,
    retry: 1,
  });
}
