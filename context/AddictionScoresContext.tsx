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
  RANK_LADDER,
  currentRankFromUnlocks,
  nextRankAfter,
  progressWithinRank,
  toRank,
  type Rank,
  type RankRow,
} from '@/constants/rankLadder';

/**
 * Faz 4 — per-addiction score + unlocked-rank hydration for the
 * Info tab. Distinct from SessionsContext, which handles the
 * cumulative view (`user_total_score`) and daily counters.
 *
 * Two server tables are read here, both SELECT-only from the client:
 *   - user_addiction_scores  → current score per addiction id
 *   - user_unlocked_ranks    → set of rank ids the user has
 *                              ever unlocked, per addiction id
 *
 * Neither table is written from the client — the resolve-craving
 * Edge Function is the sole author. This context refetches on
 * mount, on user change, and via a callable `refresh()` (invoked
 * from active-session finish so the Info tab reflects a resolve
 * without a full app relaunch).
 */

type ScoreRow = { addiction_id: string; score: number; updated_at: string };
type UnlockRow = {
  addiction_id: string;
  rank_id: string;
  unlocked_at: string;
};

/** All the derived state a Journey view needs to render a single
 *  addiction, computed once here so views don't recompute per frame. */
export type JourneyView = {
  addictionId: string;
  score: number;
  /** Set of rank ids the user has ever unlocked for this addiction. */
  unlockedIds: Set<string>;
  /** Chronological unlock records for showing dates in the ladder list. */
  unlockedAt: Map<string, string>; // rank_id → ISO timestamp
  /** "Current rank" = highest unlock (never demoted). */
  currentRank: Rank;
  /** null when the user is at rank 9 already. */
  nextRank: Rank | null;
  /** 0..1 progress fraction between current and next threshold. */
  progress: number;
};

type ContextValue = {
  /** score & unlocks for every addiction id the server knows about. */
  views: Record<string, JourneyView>;
  /** True while the initial fetch is in flight. */
  loading: boolean;
  /** Trigger a re-fetch — called from active-session after a resolve. */
  refresh: () => Promise<void>;
  /** Look up a single addiction's view; returns a zero-state view
   *  when the addiction has never been resolved (score 0 + no
   *  unlocks) so the Journey component can render without null
   *  checks. */
  viewFor: (addictionId: string) => JourneyView;
};

const AddictionScoresContext = createContext<ContextValue | undefined>(
  undefined
);

function materializeRank(row: RankRow): Rank {
  // Display-layer name/description come from i18n; the shared shape
  // omits them because the Edge Function has no i18n. Wrap the row
  // here so consumers can render without a second lookup.
  return toRank(row);
}

function nextDisplay(row: RankRow): Rank | null {
  const raw = nextRankAfter(row);
  return raw ? materializeRank(raw) : null;
}

function zeroView(addictionId: string): JourneyView {
  const floor = RANK_LADDER[0];
  return {
    addictionId,
    score: 0,
    unlockedIds: new Set<string>(),
    unlockedAt: new Map<string, string>(),
    currentRank: floor,
    nextRank: nextDisplay(floor),
    progress: 0,
  };
}

export function AddictionScoresProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setScores([]);
      setUnlocks([]);
      return;
    }
    setLoading(true);
    try {
      const [scoresRes, unlocksRes] = await Promise.all([
        supabase
          .from('user_addiction_scores')
          .select('addiction_id, score, updated_at')
          .eq('user_id', user.id),
        supabase
          .from('user_unlocked_ranks')
          .select('addiction_id, rank_id, unlocked_at')
          .eq('user_id', user.id),
      ]);
      if (scoresRes.data) setScores(scoresRes.data as ScoreRow[]);
      if (unlocksRes.data) setUnlocks(unlocksRes.data as UnlockRow[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const views = useMemo<Record<string, JourneyView>>(() => {
    const scoreByAddiction = new Map<string, number>();
    for (const row of scores) {
      scoreByAddiction.set(row.addiction_id, row.score);
    }
    const unlocksByAddiction = new Map<string, UnlockRow[]>();
    for (const row of unlocks) {
      const arr = unlocksByAddiction.get(row.addiction_id) ?? [];
      arr.push(row);
      unlocksByAddiction.set(row.addiction_id, arr);
    }
    // Materialise views for every id present in either table.
    const ids = new Set<string>([
      ...scoreByAddiction.keys(),
      ...unlocksByAddiction.keys(),
    ]);
    const out: Record<string, JourneyView> = {};
    for (const id of ids) {
      const score = scoreByAddiction.get(id) ?? 0;
      const rows = unlocksByAddiction.get(id) ?? [];
      const unlockedIds = new Set(rows.map((r) => r.rank_id));
      const unlockedAt = new Map<string, string>(
        rows.map((r) => [r.rank_id, r.unlocked_at])
      );
      const currentRow = currentRankFromUnlocks(unlockedIds);
      const progress = progressWithinRank({ score, current: currentRow });
      out[id] = {
        addictionId: id,
        score,
        unlockedIds,
        unlockedAt,
        currentRank: materializeRank(currentRow),
        nextRank: nextDisplay(currentRow),
        progress,
      };
    }
    return out;
  }, [scores, unlocks]);

  const viewFor = useCallback(
    (addictionId: string) => views[addictionId] ?? zeroView(addictionId),
    [views]
  );

  return (
    <AddictionScoresContext.Provider
      value={{ views, loading, refresh, viewFor }}
    >
      {children}
    </AddictionScoresContext.Provider>
  );
}

export function useAddictionScores() {
  const ctx = useContext(AddictionScoresContext);
  if (!ctx) {
    throw new Error(
      'useAddictionScores must be used within AddictionScoresProvider'
    );
  }
  return ctx;
}
