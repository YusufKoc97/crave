import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { calculateResistPoints, type Outcome } from '@/lib/scoring';

/**
 * Faz 3: session-level scoring, momentum, and streak are all computed
 * server-side by the resolve-craving Edge Function. This context:
 *
 *   1. Hydrates a rolling local cache of recent sessions for the
 *      profile screen's Won/Lost Today counters and weekly chart.
 *   2. Hydrates the authoritative cumulative score from
 *      `user_total_score` view (SUM(user_addiction_scores.score)).
 *   3. Hydrates momentum + streak from `profiles`.
 *   4. Provides `recordSession()` as an OPTIMISTIC local cache push —
 *      it does NOT write to the database. The Edge Function is the
 *      only writer for scores; ActiveSession invokes it directly.
 *
 * The prior client-side momentum/streak/points math is gone. This
 * file no longer touches profiles.momentum or profiles.streak; both
 * arrive as read-only server truth.
 */

export { calculateResistPoints };
export type { Outcome };

export type Session = {
  id: string;
  addictionId: string;
  outcome: Outcome;
  durationSeconds: number;
  /** Signed points delta from the resolve — positive on 'resisted',
   *  negative on 'failed'. Optimistically-estimated on the client;
   *  the server-side view holds the cumulative truth. */
  pointsDelta: number;
  sensitivity: number;
  createdAt: number;
};

type RecordInput = {
  addictionId: string;
  outcome: Outcome;
  durationSeconds: number;
  sensitivity: number;
  pointsDelta: number;
};

type SessionsContextValue = {
  sessions: Session[];
  /** Cumulative score across all addictions — from the
   *  `user_total_score` view. Not derived from `sessions`. */
  totalPoints: number;
  wonToday: number;
  lostToday: number;
  momentum: number;
  streak: number;
  recordSession: (input: RecordInput) => Session;
  /** Force a re-fetch of the server-side totals. Callers typically
   *  invoke this after a resolve-craving response returns to refresh
   *  the profile screen without waiting for the next mount. */
  refreshTotals: () => Promise<void>;
};

const SessionsContext = createContext<SessionsContextValue | undefined>(
  undefined
);

const STARTING_MOMENTUM = 50;

export function SessionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [momentum, setMomentum] = useState(STARTING_MOMENTUM);
  const [streak, setStreak] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  const refreshTotals = useCallback(async () => {
    if (!user) return;
    // Cumulative score — server-truth from the view.
    const { data: totalRow } = await supabase
      .from('user_total_score')
      .select('total_score')
      .eq('user_id', user.id)
      .maybeSingle();
    if (typeof totalRow?.total_score === 'number') {
      setTotalPoints(totalRow.total_score);
    } else {
      setTotalPoints(0);
    }

    // Momentum + streak also live on profiles now (still, but written
    // by the Edge Function instead of client). Hydrate them alongside.
    const { data: profile } = await supabase
      .from('profiles')
      .select('momentum, streak')
      .eq('id', user.id)
      .single();
    if (profile) {
      if (typeof profile.momentum === 'number') setMomentum(profile.momentum);
      if (typeof profile.streak === 'number') setStreak(profile.streak);
    }
  }, [user]);

  // ── Hydrate from Supabase on sign-in ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      // Last 30 resolved sessions, newest first. Purely for the
      // per-day tallies (Won/Lost Today + weekly bar chart). The
      // cumulative score comes from user_total_score below, not from
      // summing this list.
      const { data: rows } = await supabase
        .from('craving_sessions')
        .select(
          'id, addiction_id, outcome, duration_seconds, points_delta, sensitivity, created_at'
        )
        .eq('user_id', user.id)
        .eq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!cancelled && rows) {
        setSessions(
          rows
            .filter((r) => r.outcome && r.duration_seconds != null)
            .map((r) => ({
              id: r.id,
              addictionId: r.addiction_id,
              outcome: r.outcome as Outcome,
              durationSeconds: r.duration_seconds ?? 0,
              pointsDelta: r.points_delta ?? 0,
              sensitivity: r.sensitivity ?? 5,
              createdAt: Date.parse(r.created_at),
            }))
            .reverse()
        );
      }

      if (!cancelled) await refreshTotals();
    })();

    return () => {
      cancelled = true;
    };
  }, [user, refreshTotals]);

  const recordSession = (input: RecordInput): Session => {
    // Local cache push only — no DB write. The Edge Function is
    // authoritative; this exists so the profile Won/Lost counters
    // update the instant the user taps a decision, not after the
    // network round-trip.
    const session: Session = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      addictionId: input.addictionId,
      outcome: input.outcome,
      durationSeconds: input.durationSeconds,
      pointsDelta: input.pointsDelta,
      sensitivity: input.sensitivity,
      createdAt: Date.now(),
    };
    setSessions((prev) => [...prev, session]);
    return session;
  };

  const { wonToday, lostToday } = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayMs = startOfDay.getTime();
    let won = 0;
    let lost = 0;
    for (const s of sessions) {
      if (s.createdAt < startOfDayMs) continue;
      if (s.outcome === 'resisted') won += 1;
      else lost += 1;
    }
    return { wonToday: won, lostToday: lost };
  }, [sessions]);

  return (
    <SessionsContext.Provider
      value={{
        sessions,
        totalPoints,
        wonToday,
        lostToday,
        momentum,
        streak,
        recordSession,
        refreshTotals,
      }}
    >
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  const ctx = useContext(SessionsContext);
  if (!ctx) {
    throw new Error('useSessions must be used within SessionsProvider');
  }
  return ctx;
}
