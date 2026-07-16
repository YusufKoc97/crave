import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from '@/context/AuthContext';
import { useSessions } from '@/context/SessionsContext';

/**
 * Profile-screen statistics aggregator.
 *
 * Mostly derives from `SessionsContext` (which already hydrates
 * resolve counts + streak from the server profiles row), plus one
 * cheap Supabase call for the technique-uses-completed metric that
 * the sessions context doesn't know about.
 *
 * Uses the app-wide React Query client set up in Faz 8a. Cached
 * for the default 5-minute stale window — restarts on user change.
 * Callers get four numbers plus a `loading` flag; the hook is
 * safe to call before auth completes (returns zeros).
 *
 * "Techniques used" counts DISTINCT `technique_id`s across
 * `technique_uses` rows with `completed = true`. Half-finished
 * uses (started, never confirmed) don't count.
 */

export type UserStats = {
  cravingsResisted: number;
  longestStreakDays: number;
  successRate: number; // 0..1
  techniquesUsed: number; // distinct completed technique_ids
  loading: boolean;
};

async function fetchTechniquesUsed(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('technique_uses')
    .select('technique_id')
    .eq('user_id', userId)
    .eq('completed', true);
  if (error) throw error;
  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (row?.technique_id) seen.add(row.technique_id as string);
  }
  return seen.size;
}

export function useUserStats(): UserStats {
  const { user } = useAuth();
  const { sessions, streak } = useSessions();

  const techniquesQuery = useQuery({
    queryKey: ['user-stats-techniques', user?.id ?? 'anon'],
    queryFn: () => (user ? fetchTechniquesUsed(user.id) : Promise.resolve(0)),
    enabled: !!user,
    retry: 1,
  });

  const derived = useMemo(() => {
    let resisted = 0;
    let failed = 0;
    for (const s of sessions) {
      if (s.outcome === 'resisted') resisted += 1;
      else if (s.outcome === 'failed') failed += 1;
    }
    const total = resisted + failed;
    const successRate = total > 0 ? resisted / total : 0;
    return { resisted, successRate };
  }, [sessions]);

  return {
    cravingsResisted: derived.resisted,
    longestStreakDays: streak,
    successRate: derived.successRate,
    techniquesUsed: techniquesQuery.data ?? 0,
    loading: techniquesQuery.isLoading,
  };
}
