import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { PeriodKey } from '@/constants/heatmap';
import type { InsightCategory, InsightOutput } from '@/shared/insightRules';

/**
 * Faz 8a — client hook for the trigger-map-data Edge Function.
 *
 * Response shape mirrors the Edge Function exactly. Keep this
 * type in sync with `supabase/functions/trigger-map-data/index.ts`.
 * If either side ever drifts, TS won't catch it — smoke test.
 */

export type IntensityLevel =
  | 'mild'
  | 'moderate'
  | 'strong'
  | 'very_strong'
  | 'unbearable';

export type TriggerMapPeak = {
  day: number; // 0=Mon…6=Sun
  hour: number; // 0..23
  count: number;
};

export type TriggerMapTrigger = {
  trigger_id: string;
  count: number;
  percentage: number;
  most_common_intensity: IntensityLevel | null;
};

/** Faz 8b: server-evaluated insight card. */
export type TriggerMapInsight = InsightOutput;
export type { InsightCategory };

export type TriggerMapResponse = {
  cravings_count: number;
  heatmap: number[][]; // [7][24]
  intensity_map: (number | null)[][]; // [7][24] — avg intensity
  peak_hours: TriggerMapPeak[];
  triggers: TriggerMapTrigger[];
  // Faz 8b: top-3 by priority, empty when no rule fires.
  insights: TriggerMapInsight[];
};

async function fetchTriggerMap(
  addictionId: string,
  period: PeriodKey
): Promise<TriggerMapResponse> {
  const { data, error } = await supabase.functions.invoke('trigger-map-data', {
    body: { addiction_id: addictionId, period },
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('trigger_map_unexpected_response');
  }
  return data as TriggerMapResponse;
}

/**
 * React Query hook — cache-keyed by (addictionId, period). Same
 * `staleTime` (5 min) as the QueryClient default; overriding here
 * would just clutter the callsite.
 *
 * Callers that want to force a fresh fetch after a mutation
 * (resolve-craving landing) should call
 * `invalidateTriggerMaps()` in `lib/queryClient.ts` rather than
 * touching this hook directly.
 */
export function useTriggerMap(addictionId: string, period: PeriodKey) {
  return useQuery({
    queryKey: ['trigger-map', addictionId, period],
    queryFn: () => fetchTriggerMap(addictionId, period),
    // Info tab often opens without a live network — don't spin
    // forever if the Edge Function isn't reachable.
    retry: 1,
  });
}
