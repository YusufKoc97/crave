/**
 * resolve-craving — server-authoritative session resolver.
 *
 * Faz 5 REVERSAL — post-resolve trigger capture.
 *
 * The client no longer INSERTs a craving_sessions row on timer
 * mount. This endpoint now does the ENTIRE lifecycle atomically:
 *   1. INSERT craving_sessions (client-provided UUID as PK, or
 *      PK conflict returns previously-computed response for idempotency)
 *   2. INSERT craving_session_triggers (best-effort)
 *   3. UPSERT user_addiction_scores
 *   4. INSERT user_unlocked_ranks (for newly-crossed thresholds)
 *   5. UPDATE profiles.momentum + streak
 *
 * Score/momentum/streak/rank progression are all still computed
 * here — a jailbroken client can't inflate its numbers.
 *
 * Request (POST, JWT-auth):
 *   {
 *     session_id: uuid,     // client-generated PK
 *     addiction_id: string, // from the 10-item catalog
 *     started_at: iso,      // client wall-clock
 *     ended_at: iso,        // client wall-clock
 *     sensitivity: 1..10,
 *     outcome: 'resisted' | 'failed',
 *     intensity?: 1..5,     // only meaningful on resisted
 *     trigger_ids: string[] // ≥1 required (client enforces min-1)
 *   }
 *
 * Response:
 *   200 { new_score, points_delta, duration_minutes, total_score,
 *         momentum, streak, newly_unlocked_ranks[] }
 *   400 for bad input / duration > 24h
 *   403 for cross-user session ids
 *
 * Deploy: `supabase functions deploy resolve-craving`
 */

// @ts-expect-error — Deno resolves this from its runtime, not npm.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  applyOutcome,
  localDayKey,
  MAX_SESSION_MINUTES,
  nextMomentum,
  nextStreak,
  RATE_LIMIT_MAX_PER_HOUR,
  type Outcome,
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

  // Parse body.
  let body: {
    session_id?: unknown;
    addiction_id?: unknown;
    started_at?: unknown;
    ended_at?: unknown;
    sensitivity?: unknown;
    outcome?: unknown;
    intensity?: unknown;
    trigger_ids?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  // ─── Validate ───
  if (typeof body.session_id !== 'string') {
    return jsonResponse({ error: 'session_id_required' }, 400);
  }
  const sessionId = body.session_id;

  if (
    typeof body.addiction_id !== 'string' ||
    !isKnownAddiction(body.addiction_id)
  ) {
    return jsonResponse({ error: 'invalid_addiction' }, 400);
  }
  const addictionId = body.addiction_id;

  if (typeof body.started_at !== 'string') {
    return jsonResponse({ error: 'started_at_required' }, 400);
  }
  const startedAtMs = Date.parse(body.started_at);
  if (Number.isNaN(startedAtMs)) {
    return jsonResponse({ error: 'invalid_started_at' }, 400);
  }

  if (typeof body.ended_at !== 'string') {
    return jsonResponse({ error: 'ended_at_required' }, 400);
  }
  const endedAtMs = Date.parse(body.ended_at);
  if (Number.isNaN(endedAtMs)) {
    return jsonResponse({ error: 'invalid_ended_at' }, 400);
  }

  if (
    typeof body.sensitivity !== 'number' ||
    body.sensitivity < 1 ||
    body.sensitivity > 10
  ) {
    return jsonResponse({ error: 'invalid_sensitivity' }, 400);
  }
  const sensitivity = Math.round(body.sensitivity);

  if (body.outcome !== 'resisted' && body.outcome !== 'failed') {
    return jsonResponse({ error: 'invalid_outcome' }, 400);
  }
  const outcome = body.outcome as Outcome;

  const intensity =
    typeof body.intensity === 'number' &&
    body.intensity >= 1 &&
    body.intensity <= 5
      ? body.intensity
      : null;

  if (!Array.isArray(body.trigger_ids) || body.trigger_ids.length === 0) {
    return jsonResponse({ error: 'trigger_required' }, 400);
  }
  const triggerIds = (body.trigger_ids as unknown[]).filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
  if (triggerIds.length === 0) {
    return jsonResponse({ error: 'trigger_required' }, 400);
  }

  const durationMs = endedAtMs - startedAtMs;
  const durationMinutes = durationMs / 60_000;
  if (durationMinutes < 0) {
    return jsonResponse({ error: 'negative_duration' }, 400);
  }
  if (durationMinutes > MAX_SESSION_MINUTES) {
    return jsonResponse({ error: 'duration_exceeds_max' }, 400);
  }
  const durationSeconds = Math.floor(durationMs / 1000);

  // ─── Idempotency: session_id already resolved? ───
  const { data: existing } = await svc
    .from('craving_sessions')
    .select('id, user_id, addiction_id, status, points_delta, duration_seconds')
    .eq('id', sessionId)
    .maybeSingle();

  if (existing) {
    if (existing.user_id !== userId) {
      return jsonResponse({ error: 'forbidden' }, 403);
    }
    // Replay path — the earlier attempt got as far as INSERTing the
    // row. Return the previously-computed payload without side effects.
    // Empty newly_unlocked_ranks so the celebration doesn't re-fire.
    const { data: scoreRow } = await svc
      .from('user_addiction_scores')
      .select('score')
      .eq('user_id', userId)
      .eq('addiction_id', existing.addiction_id)
      .maybeSingle();
    const { data: totalRow } = await svc
      .from('user_total_score')
      .select('total_score')
      .eq('user_id', userId)
      .maybeSingle();
    const { data: profileRow } = await svc
      .from('profiles')
      .select('momentum, streak')
      .eq('id', userId)
      .single();
    return jsonResponse({
      new_score: scoreRow?.score ?? 0,
      points_delta: existing.points_delta ?? 0,
      duration_minutes: (existing.duration_seconds ?? 0) / 60,
      total_score: totalRow?.total_score ?? scoreRow?.score ?? 0,
      momentum: profileRow?.momentum ?? 50,
      streak: profileRow?.streak ?? 0,
      newly_unlocked_ranks: [],
      idempotent_replay: true,
    });
  }

  // ─── Log-only rate limit ───
  const bucket = utcHourBucket(new Date());
  const { data: rlRow } = await svc
    .from('rate_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('endpoint', 'resolve-craving')
    .eq('hour_bucket', bucket)
    .maybeSingle();
  const rlCount = (rlRow?.count ?? 0) + 1;
  await svc.from('rate_limits').upsert(
    {
      user_id: userId,
      endpoint: 'resolve-craving',
      hour_bucket: bucket,
      count: rlCount,
    },
    { onConflict: 'user_id,endpoint,hour_bucket' }
  );
  if (rlCount > RATE_LIMIT_MAX_PER_HOUR) {
    console.warn(
      `[resolve-craving] rate limit exceeded: user=${userId} bucket=${bucket} count=${rlCount}`
    );
  }

  // ─── Score computation ───
  const { data: existingScoreRow } = await svc
    .from('user_addiction_scores')
    .select('score')
    .eq('user_id', userId)
    .eq('addiction_id', addictionId)
    .maybeSingle();
  const currentScore = existingScoreRow?.score ?? 0;

  const { newScore, delta } = applyOutcome({
    currentScore,
    outcome,
    durationSeconds,
    sensitivity,
  });

  const persistIntensity = outcome === 'resisted' ? intensity : null;

  // ─── Atomic INSERT of the session row ───
  const { error: sessionInsertErr } = await svc
    .from('craving_sessions')
    .insert({
      id: sessionId,
      user_id: userId,
      addiction_id: addictionId,
      status: 'resolved',
      outcome,
      started_at: new Date(startedAtMs).toISOString(),
      ended_at: new Date(endedAtMs).toISOString(),
      duration_seconds: durationSeconds,
      sensitivity,
      points_delta: delta,
      intensity: persistIntensity,
    });
  if (sessionInsertErr) {
    // Racing replay (client sent two invokes on flaky net) can land
    // here after the earlier idempotency check — the second attempt
    // hits the PK. Return the same replay payload.
    const isConflict =
      typeof (sessionInsertErr as { code?: unknown }).code === 'string' &&
      (sessionInsertErr as { code: string }).code === '23505';
    if (isConflict) {
      const { data: scoreRow } = await svc
        .from('user_addiction_scores')
        .select('score')
        .eq('user_id', userId)
        .eq('addiction_id', addictionId)
        .maybeSingle();
      return jsonResponse({
        new_score: scoreRow?.score ?? 0,
        points_delta: delta,
        duration_minutes: durationMinutes,
        total_score: scoreRow?.score ?? 0,
        momentum: 50,
        streak: 0,
        newly_unlocked_ranks: [],
        idempotent_replay: true,
      });
    }
    console.error('[resolve-craving] session insert failed', sessionInsertErr);
    return jsonResponse({ error: 'session_insert_failed' }, 500);
  }

  // ─── Trigger rows (best-effort — session already alive) ───
  const triggerRows = triggerIds.map((tid) => ({
    session_id: sessionId,
    trigger_id: tid,
  }));
  const { error: triggerErr } = await svc
    .from('craving_session_triggers')
    .insert(triggerRows);
  if (triggerErr) {
    console.warn('[resolve-craving] trigger insert failed', triggerErr);
    // Non-fatal — Modül 3 loses this session's tags but scoring works.
  }

  // ─── Score UPSERT ───
  const { error: scoreErr } = await svc.from('user_addiction_scores').upsert(
    {
      user_id: userId,
      addiction_id: addictionId,
      score: newScore,
    },
    { onConflict: 'user_id,addiction_id' }
  );
  if (scoreErr) {
    console.error('[resolve-craving] score upsert failed', scoreErr);
    return jsonResponse({ error: 'score_write_failed' }, 500);
  }

  // ─── Rank unlock detection ───
  const { data: existingUnlocksRows } = await svc
    .from('user_unlocked_ranks')
    .select('rank_id')
    .eq('user_id', userId)
    .eq('addiction_id', addictionId);
  const alreadyUnlocked = new Set(
    (existingUnlocksRows ?? []).map((r: { rank_id: string }) => r.rank_id)
  );
  const newlyUnlocked = newlyUnlockedRanks({
    previousScore: currentScore,
    newScore,
    alreadyUnlocked,
  });
  if (newlyUnlocked.length > 0) {
    const rankRows = newlyUnlocked.map((rankId) => ({
      user_id: userId,
      addiction_id: addictionId,
      rank_id: rankId,
    }));
    const { error: rankErr } = await svc
      .from('user_unlocked_ranks')
      .upsert(rankRows, {
        onConflict: 'user_id,addiction_id,rank_id',
        ignoreDuplicates: true,
      });
    if (rankErr) {
      console.error('[resolve-craving] rank unlock write failed', rankErr);
    }
  }

  // ─── Momentum + streak ───
  const { data: profile } = await svc
    .from('profiles')
    .select('momentum, streak')
    .eq('id', userId)
    .single();
  const currentMomentum = profile?.momentum ?? 50;
  const currentStreak = profile?.streak ?? 0;

  let updatedMomentum = currentMomentum;
  let updatedStreak = currentStreak;

  if (outcome === 'resisted') {
    updatedMomentum = nextMomentum({
      currentMomentum,
      durationSeconds,
      sensitivity,
    });

    const { data: lastResist } = await svc
      .from('craving_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .eq('outcome', 'resisted')
      .eq('status', 'resolved')
      .neq('id', sessionId) // exclude the row we just wrote
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastResistDay = lastResist
      ? localDayKey(Date.parse(lastResist.created_at))
      : null;
    updatedStreak = nextStreak({
      lastResistDay,
      today: localDayKey(endedAtMs),
      currentStreak,
    });

    await svc
      .from('profiles')
      .update({ momentum: updatedMomentum, streak: updatedStreak })
      .eq('id', userId);
  }

  const { data: totalRow } = await svc
    .from('user_total_score')
    .select('total_score')
    .eq('user_id', userId)
    .maybeSingle();

  return jsonResponse({
    new_score: newScore,
    points_delta: delta,
    duration_minutes: durationMinutes,
    total_score: totalRow?.total_score ?? newScore,
    momentum: updatedMomentum,
    streak: updatedStreak,
    newly_unlocked_ranks: newlyUnlocked,
  });
});
