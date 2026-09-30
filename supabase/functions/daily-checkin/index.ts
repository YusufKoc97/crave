/**
 * daily-checkin — server-authoritative "craving-free day" claim.
 *
 * The app cannot know whether a quiet day was clean or simply unlogged,
 * so this is a self-report whose payout is deliberately small
 * (shared/scoring.ts CLEAN_DAY_POINTS) and tightly bounded. Everything
 * that limits abuse lives HERE, not in the client:
 *
 *   - the day must be FINISHED in the caller's timezone and no older
 *     than CLEAN_DAY_CLAIM_WINDOW_HOURS;
 *   - the addiction must be active and already tracked by then;
 *   - no craving session for that addiction may exist in that day
 *     (a logged resist already paid; a logged slip is not clean);
 *   - one claim per (user, addiction, day) — the daily_checkins primary
 *     key, so a retry can never pay twice;
 *   - the payout is clipped by the same per-addiction daily cap as
 *     sessions, and the hourly rate limit fails closed.
 *
 * Request (POST, JWT-auth):
 *   { addiction_id: string, day: 'YYYY-MM-DD',
 *     tz_offset_minutes: number }   // JS Date#getTimezoneOffset()
 *
 * Response:
 *   200 { points_delta, new_score, total_score, newly_unlocked_ranks[],
 *         already_claimed? }
 *   400 bad input · 409 { error: 'not_eligible', reason }
 *
 * Deploy: `supabase functions deploy daily-checkin`
 */

// @ts-expect-error — Deno resolves this from its runtime, not npm.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CLEAN_DAY_CLAIM_WINDOW_HOURS,
  CLEAN_DAY_POINTS,
  isValidDayKey,
  localDayWindow,
  MAX_DAILY_POINTS_PER_ADDICTION,
  RATE_LIMIT_MAX_PER_HOUR,
} from '../../../shared/scoring.ts';
import { isKnownAddiction } from '../../../shared/catalog.ts';
import { newlyUnlockedRanks } from '../../../shared/ranks.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const jsonHeaders: Record<string, string> = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function notEligible(reason: string): Response {
  return jsonResponse({ error: 'not_eligible', reason }, 409);
}

function utcHourBucket(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const jwt = authHeader.slice('Bearer '.length);

  const anonClient = createClient(
    SUPABASE_URL,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: userData, error: userErr } = await anonClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const userId = userData.user.id;

  let body: {
    addiction_id?: unknown;
    day?: unknown;
    tz_offset_minutes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  if (
    typeof body.addiction_id !== 'string' ||
    !isKnownAddiction(body.addiction_id)
  ) {
    return jsonResponse({ error: 'invalid_addiction' }, 400);
  }
  const addictionId = body.addiction_id;

  if (!isValidDayKey(body.day)) {
    return jsonResponse({ error: 'invalid_day' }, 400);
  }
  const day = body.day;

  // Real-world offsets run UTC-12 … UTC+14 (JS sign: minutes BEHIND UTC).
  if (
    typeof body.tz_offset_minutes !== 'number' ||
    !Number.isFinite(body.tz_offset_minutes) ||
    body.tz_offset_minutes < -14 * 60 ||
    body.tz_offset_minutes > 12 * 60
  ) {
    return jsonResponse({ error: 'invalid_tz_offset' }, 400);
  }
  const tzOffset = Math.round(body.tz_offset_minutes);
  const { startMs, endMs } = localDayWindow(day, tzOffset);

  // ─── Day must be finished, and not too old ───
  const now = new Date();
  const nowMs = now.getTime();
  if (endMs > nowMs) return notEligible('day_not_finished');
  if (startMs < nowMs - CLEAN_DAY_CLAIM_WINDOW_HOURS * 3_600_000) {
    return notEligible('day_too_old');
  }

  // ─── Addiction must be active and tracked by then ───
  const { data: tracked } = await svc
    .from('user_addictions')
    .select('added_at, is_active')
    .eq('user_id', userId)
    .eq('addiction_id', addictionId)
    .maybeSingle();
  if (!tracked || tracked.is_active === false) {
    return notEligible('not_tracked');
  }
  if (Date.parse(tracked.added_at) >= endMs) {
    // Added after that day ended — there was nothing to stay clean of yet.
    return notEligible('not_tracked_yet');
  }

  // ─── Already claimed? (cheap probe before spending rate budget) ───
  const { data: existing } = await svc
    .from('daily_checkins')
    .select('points')
    .eq('user_id', userId)
    .eq('addiction_id', addictionId)
    .eq('day', day)
    .maybeSingle();
  if (existing) {
    return replay(svc, userId, addictionId);
  }

  // ─── A logged craving that day means it was not a "clean" day ───
  const { count: sessionCount, error: sessErr } = await svc
    .from('craving_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('addiction_id', addictionId)
    .gte('ended_at', new Date(startMs).toISOString())
    .lt('ended_at', new Date(endMs).toISOString());
  if (sessErr) {
    console.error('[daily-checkin] session probe failed', sessErr);
    return jsonResponse({ error: 'probe_failed' }, 500);
  }
  if ((sessionCount ?? 0) > 0) return notEligible('had_sessions');

  // ─── Hourly rate limit (fail closed, same as resolve-craving) ───
  const { data: rlCount, error: rlErr } = await svc.rpc('bump_rate_limit', {
    p_user: userId,
    p_endpoint: 'daily-checkin',
    p_bucket: utcHourBucket(now),
    p_amount: 1,
  });
  if (rlErr) {
    console.error('[daily-checkin] rate limit check failed', rlErr);
    return jsonResponse({ error: 'rate_limit_unavailable' }, 503);
  }
  if ((rlCount ?? 0) > RATE_LIMIT_MAX_PER_HOUR) {
    return jsonResponse({ error: 'rate_limited' }, 429);
  }

  // ─── Daily cap: same per-addiction bucket the sessions spend from ───
  let delta = CLEAN_DAY_POINTS;
  const { data: spent, error: capErr } = await svc.rpc('bump_rate_limit', {
    p_user: userId,
    p_endpoint: `points:${addictionId}`,
    p_bucket: day,
    p_amount: delta,
  });
  if (capErr) {
    console.error('[daily-checkin] daily cap check failed', capErr);
    return jsonResponse({ error: 'rate_limit_unavailable' }, 503);
  }
  const overshoot = (spent ?? 0) - MAX_DAILY_POINTS_PER_ADDICTION;
  if (overshoot > 0) delta = Math.max(0, delta - overshoot);

  // ─── Claim the day. The PK makes this the idempotency guard. ───
  const { error: insertErr } = await svc.from('daily_checkins').insert({
    user_id: userId,
    addiction_id: addictionId,
    day,
    points: delta,
  });
  if (insertErr) {
    if ((insertErr as { code?: string }).code === '23505') {
      return replay(svc, userId, addictionId); // racing double-tap
    }
    console.error('[daily-checkin] insert failed', insertErr);
    return jsonResponse({ error: 'checkin_insert_failed' }, 500);
  }

  // ─── Score + rank unlocks ───
  const { data: scoreRow } = await svc
    .from('user_addiction_scores')
    .select('score')
    .eq('user_id', userId)
    .eq('addiction_id', addictionId)
    .maybeSingle();
  const currentScore = scoreRow?.score ?? 0;
  const newScore = currentScore + delta;

  const { error: scoreErr } = await svc
    .from('user_addiction_scores')
    .upsert(
      { user_id: userId, addiction_id: addictionId, score: newScore },
      { onConflict: 'user_id,addiction_id' }
    );
  if (scoreErr) {
    console.error('[daily-checkin] score upsert failed', scoreErr);
    // Undo the claim so the user can retry — otherwise the day would be
    // marked claimed while the points never landed.
    await svc
      .from('daily_checkins')
      .delete()
      .eq('user_id', userId)
      .eq('addiction_id', addictionId)
      .eq('day', day);
    return jsonResponse({ error: 'score_write_failed' }, 500);
  }

  const { data: unlockRows } = await svc
    .from('user_unlocked_ranks')
    .select('rank_id')
    .eq('user_id', userId)
    .eq('addiction_id', addictionId);
  const newlyUnlocked = newlyUnlockedRanks({
    previousScore: currentScore,
    newScore,
    alreadyUnlocked: new Set(
      (unlockRows ?? []).map((r: { rank_id: string }) => r.rank_id)
    ),
  });
  if (newlyUnlocked.length > 0) {
    const { error: rankErr } = await svc.from('user_unlocked_ranks').upsert(
      newlyUnlocked.map((rankId) => ({
        user_id: userId,
        addiction_id: addictionId,
        rank_id: rankId,
      })),
      { onConflict: 'user_id,addiction_id,rank_id', ignoreDuplicates: true }
    );
    if (rankErr) console.error('[daily-checkin] rank write failed', rankErr);
  }

  const { data: totalRow } = await svc
    .from('user_total_score')
    .select('total_score')
    .eq('user_id', userId)
    .maybeSingle();

  return jsonResponse({
    points_delta: delta,
    new_score: newScore,
    total_score: totalRow?.total_score ?? newScore,
    newly_unlocked_ranks: newlyUnlocked,
  });
});

/** A day that was already claimed: report success without paying again. */
async function replay(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  userId: string,
  addictionId: string
): Promise<Response> {
  const { data: scoreRow } = await svc
    .from('user_addiction_scores')
    .select('score')
    .eq('user_id', userId)
    .eq('addiction_id', addictionId)
    .maybeSingle();
  return jsonResponse({
    points_delta: 0,
    new_score: scoreRow?.score ?? 0,
    total_score: scoreRow?.score ?? 0,
    newly_unlocked_ranks: [],
    already_claimed: true,
  });
}
