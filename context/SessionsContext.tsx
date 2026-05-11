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
import {
  calculateResistPoints,
  localDayKey,
  nextStreak,
  type Outcome,
} from '@/lib/scoring';

// Re-export so existing imports of these from SessionsContext keep working.
export { calculateResistPoints };
export type { Outcome };

export type Session = {
  id: string;
  addictionId: string;
  outcome: Outcome;
  durationSeconds: number;
  pointsEarned: number;
  sensitivity: number;
  createdAt: number;
};

type RecordInput = {
  addictionId: string;
  outcome: Outcome;
  durationSeconds: number;
  sensitivity: number;
  /** How many full cycles the user completed during this session. Each
   *  one is worth `sensitivity * 5` bonus points on a 'resisted' outcome. */
  completedCycles?: number;
};

type SessionsContextValue = {
  sessions: Session[];
  totalPoints: number;
  wonToday: number;
  lostToday: number;
  momentum: number;
  streak: number;
  recordSession: (input: RecordInput) => Session;
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

  // ── Hydrate from Supabase on sign-in ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      // Last 30 completed sessions, newest first.
      const { data: rows } = await supabase
        .from('craving_sessions')
        .select(
          'id, addiction_id, outcome, duration_seconds, points_earned, sensitivity, created_at'
        )
        .eq('user_id', user.id)
        .eq('status', 'completed')
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
              pointsEarned: r.points_earned ?? 0,
              sensitivity: r.sensitivity ?? 5,
              createdAt: Date.parse(r.created_at),
            }))
            .reverse() // chronological: oldest → newest, matches local recordSession order
        );
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('momentum, streak')
        .eq('id', user.id)
        .single();

      if (!cancelled && profile) {
        if (typeof profile.momentum === 'number') setMomentum(profile.momentum);
        if (typeof profile.streak === 'number') setStreak(profile.streak);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Persist momentum/streak to profiles whenever they shift ─────────
  // Skip the very first run so we don't overwrite freshly-fetched values
  // with the local defaults during hydration.
  const persistProfile = useCallback(
    async (next: { momentum?: number; streak?: number }) => {
      if (!user) return;
      await supabase.from('profiles').update(next).eq('id', user.id);
    },
    [user]
  );

  const recordSession = (input: RecordInput): Session => {
    const minutes = input.durationSeconds / 60;
    const completedCycles = input.completedCycles ?? 0;
    const points = calculateResistPoints({
      outcome: input.outcome,
      durationSeconds: input.durationSeconds,
      sensitivity: input.sensitivity,
      completedCycles,
    });
    if (input.outcome === 'resisted') {
      const momentumGain = Math.max(
        1,
        Math.min(25, Math.round(input.sensitivity * 1.5 + minutes * 0.4))
      );
      const nextMomentum = Math.min(100, momentum + momentumGain);

      // Streak counts CONSECUTIVE DAYS with ≥1 resist, not consecutive
      // resists. Find the most recent prior resist in the local cache,
      // compare its calendar day to today via the pure helper.
      const today = localDayKey(Date.now());
      let lastResistDay: string | null = null;
      for (let i = sessions.length - 1; i >= 0; i--) {
        if (sessions[i].outcome === 'resisted') {
          lastResistDay = localDayKey(sessions[i].createdAt);
          break;
        }
      }
      const updatedStreak = nextStreak({
        lastResistDay,
        today,
        currentStreak: streak,
      });

      setMomentum(nextMomentum);
      setStreak(updatedStreak);
      persistProfile({ momentum: nextMomentum, streak: updatedStreak });
    }

    const session: Session = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      addictionId: input.addictionId,
      outcome: input.outcome,
      durationSeconds: input.durationSeconds,
      pointsEarned: points,
      sensitivity: input.sensitivity,
      createdAt: Date.now(),
    };

    // Local cache update for instant UI. The actual Supabase row is created
    // by active-session.tsx (INSERT on mount, UPDATE on finish) — no INSERT
    // here to avoid duplicate rows.
    setSessions((prev) => [...prev, session]);
    return session;
  };

  const { totalPoints, wonToday, lostToday } = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayMs = startOfDay.getTime();

    let totalPts = 0;
    let won = 0;
    let lost = 0;

    for (const s of sessions) {
      totalPts += s.pointsEarned;
      if (s.createdAt >= startOfDayMs) {
        if (s.outcome === 'resisted') won += 1;
        else lost += 1;
      }
    }

    return { totalPoints: totalPts, wonToday: won, lostToday: lost };
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
