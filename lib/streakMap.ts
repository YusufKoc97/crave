import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from '@/context/AuthContext';
import {
  computeStreakMap,
  type StreakMap,
  type StreakSessionRow,
} from './streakMapCore';
import { DEV_SEED_DATA, seedStreakMap } from './devSeed';

/**
 * Streak Map data hook — the Profile premium day-grid.
 *
 * Unlike `useUserStats`, this cannot lean on `SessionsContext`: that
 * context only hydrates the last 30 sessions (Won/Lost + weekly bar),
 * and the map promises history "all the way back to day one". So we
 * read the user's own full resolved-session history directly.
 *
 * This is OWN-DATA (`user_id = self`), so RLS covers it — no Edge
 * Function, same shape as `fetchTechniquesUsed`. We pull the two
 * columns the fold needs and hand them to the pure `computeStreakMap`.
 *
 * MAX_ROWS caps the payload at the most recent 5000 resolved sessions.
 * Pre-launch that is far beyond any real user; if a heavy user ever
 * crosses it, the oldest tail is dropped (newest kept), which the
 * map's "back to day one" copy slightly overstates — revisit with
 * server-side day bucketing before that becomes reachable.
 */

export type { StreakDay, StreakMap, StreakRange } from './streakMapCore';

const MAX_ROWS = 5000;

async function fetchHistory(userId: string): Promise<StreakSessionRow[]> {
  const { data, error } = await supabase
    .from('craving_sessions')
    .select('outcome, created_at')
    .eq('user_id', userId)
    .eq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);
  if (error) throw error;
  return (data ?? []) as StreakSessionRow[];
}

export type UseStreakMap = StreakMap & { loading: boolean };

export function useStreakMap(): UseStreakMap {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['streak-map', user?.id ?? 'anon'],
    queryFn: () => (user ? fetchHistory(user.id) : Promise.resolve([])),
    enabled: !!user && !DEV_SEED_DATA,
    retry: 1,
  });

  // Date.now() at fold time is fine here (component runtime, not a
  // workflow); the pure core takes it as an argument so the maths stay
  // testable. Re-folds only when the fetched rows change.
  const map = useMemo(
    () =>
      DEV_SEED_DATA
        ? seedStreakMap()
        : computeStreakMap(query.data ?? [], Date.now()),
    [query.data]
  );

  return {
    ...map,
    loading: DEV_SEED_DATA ? false : query.isLoading && !query.data,
  };
}
