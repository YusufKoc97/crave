import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { fetchUserAddictions } from './addictionsApi';
import { useAuth } from '@/context/AuthContext';
import { queryClient } from './queryClient';
import { localDayKey, localDayWindow } from '@/shared/scoring';

/**
 * Client half of the daily "craving-free day" bonus. The server
 * (supabase/functions/daily-checkin) is the authority on eligibility and
 * payout; this module only decides whether the prompt is worth SHOWING,
 * so it never offers a claim the server would refuse.
 *
 * One general bonus per day, for YESTERDAY only: a finished day cannot
 * still have a craving pending, and "today" would let the answer change
 * an hour later.
 */

const KEY = 'clean-day';

/** Local calendar day before today, as YYYY-MM-DD. */
export function yesterdayKey(now: number = Date.now()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return localDayKey(d.getTime());
}

/**
 * Can the user honestly claim a clean yesterday? They must have been
 * tracking something by then, not have claimed already, and have logged
 * no craving at all that day (a logged resist already paid; a slip is not
 * clean).
 */
async function fetchEligible(userId: string, day: string): Promise<boolean> {
  const tz = new Date().getTimezoneOffset();
  const { startMs, endMs } = localDayWindow(day, tz);

  const [tracked, claimed, sessions] = await Promise.all([
    fetchUserAddictions(userId),
    supabase
      .from('daily_checkins')
      .select('day', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('day', day),
    supabase
      .from('craving_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('ended_at', new Date(startMs).toISOString())
      .lt('ended_at', new Date(endMs).toISOString()),
  ]);
  if (claimed.error) throw claimed.error;
  if (sessions.error) throw sessions.error;

  const trackedByThen = tracked.some(
    (a) => a.isActive && Date.parse(a.addedAt) < endMs
  );
  return (
    trackedByThen && (claimed.count ?? 0) === 0 && (sessions.count ?? 0) === 0
  );
}

export function useCleanDayEligible(): { day: string; eligible: boolean } {
  const { user } = useAuth();
  const day = yesterdayKey();
  const q = useQuery({
    queryKey: [KEY, user?.id ?? null, day],
    queryFn: () => fetchEligible(user!.id, day),
    enabled: !!user,
    staleTime: 60_000,
  });
  return { day, eligible: q.data === true };
}

export function invalidateCleanDay(): void {
  void queryClient.invalidateQueries({ queryKey: [KEY] });
}

export type ClaimResult =
  | {
      ok: true;
      pointsDelta: number;
      /** The user's total points after this claim. */
      totalScore: number;
      alreadyClaimed: boolean;
    }
  | { ok: false; reason: string };

export async function claimCleanDay(day: string): Promise<ClaimResult> {
  const { data, error } = await supabase.functions.invoke('daily-checkin', {
    body: { day, tz_offset_minutes: new Date().getTimezoneOffset() },
  });
  if (error) {
    // functions-js puts the HTTP response on error.context; the 409 body
    // carries the reason ('had_sessions', 'not_tracked', …).
    let reason = 'failed';
    try {
      const body = await (
        error as unknown as { context?: Response }
      ).context?.json();
      if (typeof body?.reason === 'string') reason = body.reason;
      else if (typeof body?.error === 'string') reason = body.error;
    } catch {
      // Network failure or non-JSON body — keep the generic reason.
    }
    return { ok: false, reason };
  }
  const r = data as {
    points_delta?: number;
    total_score?: number;
    already_claimed?: boolean;
  } | null;
  return {
    ok: true,
    pointsDelta: r?.points_delta ?? 0,
    totalScore: r?.total_score ?? 0,
    alreadyClaimed: r?.already_claimed === true,
  };
}
