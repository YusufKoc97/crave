/**
 * resolve-craving — server-authoritative session resolver.
 *
 * The client calls this instead of writing to craving_sessions
 * directly. Score, momentum, streak, and rank progression are all
 * computed here so a jailbroken client can't inflate its numbers.
 *
 * Request  (POST, JWT-auth):
 *   { session_id: uuid, outcome: 'resisted' | 'failed', intensity?: 1..5 }
 *
 * Response:
 *   200 { new_score, points_delta, duration_minutes, total_score, momentum, streak }
 *   400 for bad input / duration > 24h
 *   403 for cross-user session ids
 *   409 for a session already in a terminal status (returns the previous
 *       resolution — the endpoint is idempotent on session_id)
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

// Deno globals — declared for TS. When Deno runs this file these
// are resolved from the runtime's own type-check pass.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonHeaders: Record<string, string> = {
  'content-type': 'application/json',
  // CORS — this is a public POST endpoint invoked from the RN app.
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function utcHourBucket(now: Date): string {
  // YYYY-MM-DDTHH (UTC). Cheaper than storing timestamptz + doing a
  // range scan.
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

  // Authentication — the JWT is forwarded by supabase.functions.invoke.
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const jwt = authHeader.slice('Bearer '.length);

  // Two clients: one for whoami() using the caller's JWT, one for
  // writes using the service role (bypasses the SELECT-only RLS on
  // user_addiction_scores).
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
  let body: { session_id?: unknown; outcome?: unknown; intensity?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  if (typeof body.session_id !== 'string') {
    return jsonResponse({ error: 'session_id_required' }, 400);
  }
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

  // Log-only rate limit — bump counter, warn if over cap, do not
  // block. Enforcement flag flips on later.
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

  // Fetch the session.
  const { data: session, error: sessionErr } = await svc
    .from('craving_sessions')
    .select(
      'id, user_id, addiction_id, status, outcome, started_at, ended_at, duration_seconds, sensitivity, points_delta'
    )
    .eq('id', body.session_id)
    .maybeSingle();

  if (sessionErr || !session) {
    return jsonResponse({ error: 'session_not_found' }, 404);
  }
  if (session.user_id !== userId) {
    return jsonResponse({ error: 'forbidden' }, 403);
  }
  if (!isKnownAddiction(session.addiction_id)) {
    // Legacy row from before the Faz 2 catalog — reject rather than
    // guess a sensitivity.
    return jsonResponse({ error: 'unknown_addiction' }, 400);
  }

  // Idempotency — a session already resolved returns its previous
  // outcome. Retry-safe from the client's perspective (network flake
  // resends don't double-count).
  if (session.status === 'resolved') {
    const { data: scoreRow } = await svc
      .from('user_addiction_scores')
      .select('score')
      .eq('user_id', userId)
      .eq('addiction_id', session.addiction_id)
      .maybeSingle();
    const durationMinutes = (session.duration_seconds ?? 0) / 60;
    return jsonResponse({
      new_score: scoreRow?.score ?? 0,
      points_delta: session.points_delta ?? 0,
      duration_minutes: durationMinutes,
      idempotent_replay: true,
      // Replay of a previously-resolved session never fires a new
      // celebration — any unlocks it produced already reached the
      // client on the original response. Empty list keeps the
      // celebration-queue wiring simple client-side.
      newly_unlocked_ranks: [],
    });
  }
  if (session.status === 'abandoned') {
    return jsonResponse({ error: 'session_abandoned' }, 409);
  }

  // Compute duration from the DB timestamp — client-reported values
  // are ignored so a rooted device can't forge a long duration.
  const startedAtMs = Date.parse(session.started_at);
  const nowMs = Date.now();
  const durationMs = nowMs - startedAtMs;
  const durationMinutes = durationMs / 60_000;

  if (durationMinutes < 0) {
    return jsonResponse({ error: 'negative_duration' }, 400);
  }
  if (durationMinutes > MAX_SESSION_MINUTES) {
    return jsonResponse({ error: 'duration_exceeds_max' }, 400);
  }

  const durationSeconds = Math.floor(durationMs / 1000);
  const sensitivity = session.sensitivity;

  // Read current per-addiction score.
  const { data: existingScoreRow } = await svc
    .from('user_addiction_scores')
    .select('score')
    .eq('user_id', userId)
    .eq('addiction_id', session.addiction_id)
    .maybeSingle();
  const currentScore = existingScoreRow?.score ?? 0;

  const { newScore, delta } = applyOutcome({
    currentScore,
    outcome,
    durationSeconds,
    sensitivity,
  });

  // UPSERT the score.
  const { error: scoreErr } = await svc.from('user_addiction_scores').upsert(
    {
      user_id: userId,
      addiction_id: session.addiction_id,
      score: newScore,
    },
    { onConflict: 'user_id,addiction_id' }
  );
  if (scoreErr) {
    console.error('[resolve-craving] score upsert failed', scoreErr);
    return jsonResponse({ error: 'score_write_failed' }, 500);
  }

  // Rank unlock detection. Only positive score jumps ('resisted')
  // can cross a threshold; the shared helper returns [] for failures
  // so we don't even need a branch here. INSERTs use ON CONFLICT DO
  // NOTHING semantics (PK is user_id + addiction_id + rank_id) so an
  // idempotent replay is a silent no-op.
  //
  // We fetch the caller's already-unlocked ranks for THIS addiction
  // first and pass them to the diff so a user who resolved through
  // several thresholds before the client last synced still only
  // gets INSERT rows for genuinely-new unlocks.
  const { data: existingUnlocksRows } = await svc
    .from('user_unlocked_ranks')
    .select('rank_id')
    .eq('user_id', userId)
    .eq('addiction_id', session.addiction_id);
  const alreadyUnlocked = new Set(
    (existingUnlocksRows ?? []).map((r: { rank_id: string }) => r.rank_id)
  );
  const newlyUnlocked = newlyUnlockedRanks({
    previousScore: currentScore,
    newScore,
    alreadyUnlocked,
  });
  if (newlyUnlocked.length > 0) {
    const rows = newlyUnlocked.map((rankId) => ({
      user_id: userId,
      addiction_id: session.addiction_id,
      rank_id: rankId,
    }));
    const { error: rankErr } = await svc
      .from('user_unlocked_ranks')
      // upsert with the PK on-conflict is our idempotent INSERT.
      .upsert(rows, {
        onConflict: 'user_id,addiction_id,rank_id',
        ignoreDuplicates: true,
      });
    if (rankErr) {
      // Non-fatal — score already landed. Log and keep going so the
      // user still gets their delta banner. The next resolve will
      // pick these up on the retry diff.
      console.error('[resolve-craving] rank unlock write failed', rankErr);
    }
  }

  // Momentum + streak — only bump on a successful resist.
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

    // Look up the previous resist day for this user across ALL
    // addictions — streak is a per-user calendar concept, not
    // per-addiction.
    const { data: lastResist } = await svc
      .from('craving_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .eq('outcome', 'resisted')
      .eq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastResistDay = lastResist
      ? localDayKey(Date.parse(lastResist.created_at))
      : null;
    updatedStreak = nextStreak({
      lastResistDay,
      today: localDayKey(nowMs),
      currentStreak,
    });

    await svc
      .from('profiles')
      .update({ momentum: updatedMomentum, streak: updatedStreak })
      .eq('id', userId);
  }

  // Finalise the session row.
  // Faz 5: `intensity` is captured only on 'resisted' via the
  // post-resist rating modal. On 'failed' we always pass null so
  // an old cached value can't linger — though the client already
  // sends null in that case, defence in depth here.
  const persistIntensity = outcome === 'resisted' ? intensity : null;
  await svc
    .from('craving_sessions')
    .update({
      status: 'resolved',
      outcome,
      ended_at: new Date(nowMs).toISOString(),
      duration_seconds: durationSeconds,
      points_delta: delta,
      intensity: persistIntensity,
    })
    .eq('id', session.id);

  // Total score across all addictions — from the view for
  // consistency with what the profile screen reads.
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
