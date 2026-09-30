import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { fetchUserAddictions } from './addictionsApi';
import { useAuth } from '@/context/AuthContext';
import { queryClient } from './queryClient';
import { localDayKey, localDayWindow } from '@/shared/scoring';

/**
 * Client half of the "craving-free day" check-in. The server
 * (supabase/functions/daily-checkin) is the authority on eligibility and
 * payout; this module only decides what is worth ASKING the user, so the
 * prompt never offers a claim the server would refuse.
 *
 * Only YESTERDAY is offered. A finished day cannot still have a craving
 * pending, and "today" would let the answer change an hour later.
 */

const KEY = 'clean-day';

/** Local calendar day before today, as YYYY-MM-DD. */
export function yesterdayKey(now: number = Date.now()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return localDayKey(d.getTime());
}

/**
 * Addictions the user could honestly claim a clean yesterday for:
 * tracked before that day ended, not already claimed, and with no
 * logged craving that day (a logged resist already paid; a slip is not
 * clean).
 */
async function fetchCandidates(userId: string, day: string): Promise<string[]> {
  const tz = new Date().getTimezoneOffset();
  const { startMs, endMs } = localDayWindow(day, tz);

  const [tracked, claimed, sessions] = await Promise.all([
    fetchUserAddictions(userId),
    supabase
      .from('daily_checkins')
      .select('addiction_id')
      .eq('user_id', userId)
      .eq('day', day),
    supabase
      .from('craving_sessions')
      .select('addiction_id')
      .eq('user_id', userId)
      .gte('ended_at', new Date(startMs).toISOString())
      .lt('ended_at', new Date(endMs).toISOString()),
  ]);
  if (claimed.error) throw claimed.error;
  if (sessions.error) throw sessions.error;

  const claimedIds = new Set(claimed.data.map((r) => r.addiction_id));
  const busyIds = new Set(sessions.data.map((r) => r.addiction_id));
  return tracked
    .filter(
      (a) =>
        a.isActive &&
        Date.parse(a.addedAt) < endMs &&
        !claimedIds.has(a.addictionId) &&
        !busyIds.has(a.addictionId)
    )
    .map((a) => a.addictionId);
}

export function useCleanDayCandidates(): {
  day: string;
  addictionIds: string[];
} {
  const { user } = useAuth();
  const day = yesterdayKey();
  const q = useQuery({
    queryKey: [KEY, user?.id ?? null, day],
    queryFn: () => fetchCandidates(user!.id, day),
    enabled: !!user,
    staleTime: 60_000,
  });
  return { day, addictionIds: q.data ?? [] };
}

export function invalidateCleanDay(): void {
  void queryClient.invalidateQueries({ queryKey: [KEY] });
}

export type ClaimResult =
  | {
      ok: true;
      pointsDelta: number;
      alreadyClaimed: boolean;
      newlyUnlockedRanks: string[];
    }
  | { ok: false; reason: string };

export async function claimCleanDay(
  addictionId: string,
  day: string
): Promise<ClaimResult> {
  const { data, error } = await supabase.functions.invoke('daily-checkin', {
    body: {
      addiction_id: addictionId,
      day,
      tz_offset_minutes: new Date().getTimezoneOffset(),
    },
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
    already_claimed?: boolean;
    newly_unlocked_ranks?: string[];
  } | null;
  return {
    ok: true,
    pointsDelta: r?.points_delta ?? 0,
    alreadyClaimed: r?.already_claimed === true,
    newlyUnlockedRanks: r?.newly_unlocked_ranks ?? [],
  };
}
