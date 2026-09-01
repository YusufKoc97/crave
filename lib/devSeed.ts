/**
 * DEV-ONLY random data seed — TEMPORARY visual QA aid.
 *
 * A fresh account reads zero everywhere (points, rank, streak,
 * roadmap, the new Streak Map…), which makes it impossible to eyeball
 * whether the filled-in states render correctly. Flipping DEV_SEED_DATA
 * on makes every profile/journey hook return plausible RANDOM data so
 * all the "has data" visuals can be checked at once — WITHOUT writing a
 * single row to Supabase.
 *
 * Reversible in one line: set DEV_SEED_DATA to false (or delete this
 * file's four call sites). Double-guarded by `__DEV__` so it can never
 * ship in a production bundle.
 *
 * The seed is deterministic (fixed RNG seed, computed once) so the
 * numbers and the grid stay stable across re-renders instead of
 * reshuffling every frame.
 *
 * Wired into: lib/streakMap.ts, lib/userStats.ts,
 * context/SessionsContext.tsx, context/AddictionScoresContext.tsx.
 */

import { ranksReachedAt } from '@/shared/ranks';
import { computeStreakMap, type StreakMap } from './streakMapCore';
import type { Session } from '@/context/SessionsContext';

/** TEMPORARY: set to false to turn the fake data off. */
export const DEV_SEED_DATA = __DEV__ && true;

// Every addiction id the catalog knows — seeding all of them means any
// id the user actually tracks lights up in the feeding list.
const ADDICTION_IDS = [
  'nicotine',
  'alcohol',
  'caffeine',
  'vape',
  'gambling',
  'junk_food',
  'shopping',
  'pmo',
  'doomscroll',
  'gaming',
] as const;

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

// Small, seedable PRNG so the fake data is stable between renders.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── History rows, built once ──────────────────────────────────────
// Raw {outcome, created_at} across ~160 days: most days active with a
// 1–4 resist density, a sprinkling of give-ins, and some quiet days —
// exactly the texture the Streak Map + Lifetime panel need.
type RawRow = { outcome: string; created_at: string };
let rawRowsCache: RawRow[] | null = null;

function rawRows(nowMs: number): RawRow[] {
  if (rawRowsCache) return rawRowsCache;
  const rng = mulberry32(1337);
  const rows: RawRow[] = [];
  for (let d = 160; d >= 0; d--) {
    const dayMs = nowMs - d * DAY_MS;
    if (rng() < 0.18) continue; // ~quiet day, no sessions
    const giveIn = rng() < 0.13;
    const resists = giveIn ? Math.floor(rng() * 2) : 1 + Math.floor(rng() * 4);
    for (let i = 0; i < resists; i++) {
      const at = dayMs - Math.floor(rng() * 10) * HOUR_MS;
      rows.push({
        outcome: 'resisted',
        created_at: new Date(at).toISOString(),
      });
    }
    if (giveIn) {
      const at = dayMs - Math.floor(rng() * 10) * HOUR_MS;
      rows.push({ outcome: 'failed', created_at: new Date(at).toISOString() });
    }
  }
  rawRowsCache = rows;
  return rows;
}

// ── Streak Map ────────────────────────────────────────────────────
export function seedStreakMap(nowMs = Date.now()): StreakMap {
  return computeStreakMap(rawRows(nowMs), nowMs);
}

// ── SessionsContext (won/lost today, weekly bar, totals) ──────────
export function seedSessions(nowMs = Date.now()): Session[] {
  const rng = mulberry32(7);
  return rawRows(nowMs).map((r, i) => ({
    id: `dev-${i}`,
    addictionId: ADDICTION_IDS[i % ADDICTION_IDS.length],
    outcome: r.outcome as Session['outcome'],
    durationSeconds: 30 + Math.floor(rng() * 600),
    pointsDelta: r.outcome === 'resisted' ? 5 + Math.floor(rng() * 40) : -20,
    sensitivity: 1 + Math.floor(rng() * 9),
    createdAt: Date.parse(r.created_at),
  }));
}

export function seedTotals(): {
  totalPoints: number;
  streak: number;
  momentum: number;
} {
  const rng = mulberry32(99);
  return {
    // Lands the overall rank mid-ladder so the roadmap shows real
    // progress-to-next rather than a floor or a ceiling.
    totalPoints: 2500 + Math.floor(rng() * 12000),
    streak: 4 + Math.floor(rng() * 40),
    momentum: 45 + Math.floor(rng() * 50),
  };
}

// ── Per-addiction scores + unlocked ranks (feeding rows, journeys) ─
export function seedScoreRows(): {
  addiction_id: string;
  score: number;
  updated_at: string;
}[] {
  const rng = mulberry32(51);
  const now = new Date().toISOString();
  // A spread of tiers so different feeding rows sit at different ranks.
  const tiers = [80, 320, 900, 1900, 4200, 9500, 18000];
  return ADDICTION_IDS.map((id, i) => ({
    addiction_id: id,
    score: tiers[(i + Math.floor(rng() * tiers.length)) % tiers.length],
    updated_at: now,
  }));
}

export function seedUnlockRows(): {
  addiction_id: string;
  rank_id: string;
  unlocked_at: string;
}[] {
  const now = new Date().toISOString();
  const scores = seedScoreRows();
  const rows: { addiction_id: string; rank_id: string; unlocked_at: string }[] =
    [];
  for (const s of scores) {
    for (const rank of ranksReachedAt(s.score)) {
      rows.push({
        addiction_id: s.addiction_id,
        rank_id: rank.id,
        unlocked_at: now,
      });
    }
  }
  return rows;
}

// ── Lifetime panel stats ──────────────────────────────────────────
export function seedUserStats(): {
  cravingsResisted: number;
  longestStreakDays: number;
  successRate: number;
  techniquesUsed: number;
  loading: boolean;
} {
  const rows = rawRows(Date.now());
  let resisted = 0;
  let failed = 0;
  for (const r of rows) {
    if (r.outcome === 'resisted') resisted += 1;
    else if (r.outcome === 'failed') failed += 1;
  }
  const total = resisted + failed;
  return {
    cravingsResisted: resisted,
    // Same resist-streak the medallion means and SessionsContext feeds,
    // so the one streak number reads consistently everywhere.
    longestStreakDays: seedTotals().streak,
    successRate: total > 0 ? resisted / total : 0,
    techniquesUsed: 6,
    loading: false,
  };
}
