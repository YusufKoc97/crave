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
 *     intensity?: 1..10,    // only meaningful on resisted
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
  MAX_DAILY_POINTS_PER_ADDICTION,
  MAX_SESSION_MINUTES,
  nextMomentum,
  RATE_LIMIT_MAX_PER_HOUR,
  streakAfterGiveIn,
  streakAfterResist,
  STREAK_PROTECTION_MONTHLY_CAP,
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Hard cap on tags per session. The client allows 3
 *  (components/TriggerCaptureModal.tsx MAX_TAGS); 8 leaves headroom
 *  for a future redesign without leaving the column unbounded. */
const MAX_TRIGGERS_PER_SESSION = 8;

/** Seconds until the current UTC hour bucket rolls over — the honest
 *  Retry-After for a rate-limited caller. */
function secondsToNextHour(now: Date): number {
  return 3600 - (now.getUTCMinutes() * 60 + now.getUTCSeconds());
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
  // Must be a real UUID. Without this, a malformed id makes the
  // `.eq('id', …)` idempotency probe below raise Postgres 22P02 — and
  // that error is destructured away, so execution used to fall through
  // a rate-limit write and two reads before dying on the INSERT. Fail
  // fast instead of paying for the round-trips.
  if (!UUID_RE.test(body.session_id)) {
    return jsonResponse({ error: 'invalid_session_id' }, 400);
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
    body.intensity <= 10
      ? body.intensity
      : null;

  if (!Array.isArray(body.trigger_ids) || body.trigger_ids.length === 0) {
    return jsonResponse({ error: 'trigger_required' }, 400);
  }
  // Bound the array before doing any work with it. Unbounded, a single
  // request could write arbitrarily many rows and then inflate every
  // Info-tab aggregate that reads them back.
  if (body.trigger_ids.length > MAX_TRIGGERS_PER_SESSION) {
    return jsonResponse({ error: 'too_many_triggers' }, 400);
  }
  // Shape-check each id to match the DB CHECK added in migration 009,
  // so a bad tag is a clean 400 here rather than a 500 from the
  // constraint after the session row is already committed.
  const triggerIds = (body.trigger_ids as unknown[]).filter(
    (id): id is string => typeof id === 'string' && /^[a-z0-9_]{1,40}$/.test(id)
  );
  if (triggerIds.length === 0) {
    return jsonResponse({ error: 'trigger_required' }, 400);
  }

  // Clock sanity, deliberately loose. A pending-finish blob replayed
  // after days offline (app/_layout.tsx) is legitimate, so we do NOT
  // require the timestamps to be near "now" — only that they aren't in
  // the future or absurdly old. Tightening this further would convert
  // recoverable offline sessions into permanent 400 retry loops.
  const nowMs = Date.now();
  if (endedAtMs > nowMs + 5 * 60_000) {
    return jsonResponse({ error: 'ended_at_in_future' }, 400);
  }
  if (startedAtMs < nowMs - 30 * 86_400_000) {
    return jsonResponse({ error: 'started_at_too_old' }, 400);
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

  // ─── Rate limit (ENFORCED) ───
  //
  // Sits AFTER the idempotency early-return on purpose: that path is
  // the offline-recovery replay, and counting replays against quota
  // would penalise exactly the honest user with flaky connectivity.
  // Only fresh awards consume budget.
  //
  // bump_rate_limit (migration 009) does the increment in ONE
  // statement and returns the new value. The previous read-then-upsert
  // was last-write-wins, so N concurrent calls all read k and all
  // wrote k+1 — a 429 layered on top of that would have been
  // bypassable by simply firing requests in parallel.
  const now = new Date();
  const bucket = utcHourBucket(now);
  const { data: rlCount, error: rlErr } = await svc.rpc('bump_rate_limit', {
    p_user: userId,
    p_endpoint: 'resolve-craving',
    p_bucket: bucket,
    p_amount: 1,
  });
  if (rlErr) {
    // Fail CLOSED. An unavailable limiter must not silently become an
    // unlimited endpoint — that is the exact failure this replaces.
    console.error('[resolve-craving] rate limit check failed', rlErr);
    return jsonResponse({ error: 'rate_limit_unavailable' }, 503);
  }
  if ((rlCount ?? 0) > RATE_LIMIT_MAX_PER_HOUR) {
    console.warn(
      `[resolve-craving] rate limited: user=${userId} bucket=${bucket} count=${rlCount}`
    );
    return jsonResponse(
      {
        error: 'rate_limited',
        retry_after_seconds: secondsToNextHour(now),
      },
      429
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

  const rawOutcome = applyOutcome({
    currentScore,
    outcome,
    durationSeconds,
    sensitivity,
  });

  // ─── Daily gain ceiling, per (user, addiction) ───
  //
  // The hourly call limit alone does NOT bound score: even clamped to
  // MAX_SCORED_MINUTES, 20 calls/hour still awards far more than the
  // ladder is designed to absorb. This caps what a calendar day can
  // add, so the top rank takes weeks of real use rather than one
  // scripted burst.
  //
  // Reuses the same atomic counter, keyed by day instead of hour, and
  // only ever consumes budget for positive deltas — a failure penalty
  // must never be blocked by a spending cap.
  let delta = rawOutcome.delta;
  if (delta > 0) {
    const dayKey = localDayKey(endedAtMs);
    const { data: spent, error: capErr } = await svc.rpc('bump_rate_limit', {
      p_user: userId,
      p_endpoint: `points:${addictionId}`,
      p_bucket: dayKey,
      p_amount: delta,
    });
    if (capErr) {
      console.error('[resolve-craving] daily cap check failed', capErr);
      return jsonResponse({ error: 'rate_limit_unavailable' }, 503);
    }
    const overshoot = (spent ?? 0) - MAX_DAILY_POINTS_PER_ADDICTION;
    if (overshoot > 0) {
      // Clip rather than reject: the session still resolves and still
      // counts as a resist, it just stops paying out. Rejecting here
      // would lose a genuine resist over an accounting limit.
      delta = Math.max(0, delta - overshoot);
      console.warn(
        `[resolve-craving] daily cap hit: user=${userId} addiction=${addictionId} day=${dayKey}`
      );
    }
  }
  const newScore = Math.max(0, currentScore + delta);

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
    .select(
      'momentum, streak, is_premium, streak_protection_period, streak_protection_used'
    )
    .eq('id', userId)
    .single();
  const currentMomentum = profile?.momentum ?? 50;
  const currentStreak = profile?.streak ?? 0;
  // Server-authoritative premium flag. The client useIsPremium() hook
  // is not visible in this runtime; RevenueCat's webhook flips this
  // column later and the streak-protection branch below picks it up.
  const isPremium = profile?.is_premium ?? false;

  let updatedMomentum = currentMomentum;
  let updatedStreak = currentStreak;
  // Set true only when this specific slip was actually softened by a
  // premium protection (used in the response so the client can show
  // "streak dropped to X" instead of "reset to 0").
  let protectionApplied = false;

  if (outcome === 'resisted') {
    updatedMomentum = nextMomentum({
      currentMomentum,
      durationSeconds,
      sensitivity,
    });
    // Event-based streak: each resist extends the consecutive-resist
    // run by 1. Calendar days are irrelevant — a craving-free day
    // neither advances nor breaks it, and multiple resists in one day
    // each count.
    updatedStreak = streakAfterResist(currentStreak);

    await svc
      .from('profiles')
      .update({ momentum: updatedMomentum, streak: updatedStreak })
      .eq('id', userId);
  } else {
    // 'failed' (gave in) breaks the run. Without protection → 0.
    //
    // Streak Protection (premium) softens a slip to half the streak,
    // but only up to STREAK_PROTECTION_MONTHLY_CAP times per calendar
    // month — unlimited softening would drain the streak of meaning.
    // The counter lives on the profile row; a change of month resets it
    // implicitly (we compare the stored period to the current one rather
    // than running a scheduled reset). Momentum is left untouched on a
    // slip — only the streak reflects the outcome.
    const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const storedPeriod = profile?.streak_protection_period ?? null;
    const usedThisPeriod =
      storedPeriod === currentPeriod
        ? (profile?.streak_protection_used ?? 0)
        : 0;

    // A protection is only meaningful when there's actually a run to
    // save (streak > 0), so a slip at streak 0 never consumes a monthly
    // allowance.
    protectionApplied =
      isPremium &&
      currentStreak > 0 &&
      usedThisPeriod < STREAK_PROTECTION_MONTHLY_CAP;

    updatedStreak = streakAfterGiveIn(currentStreak, protectionApplied);

    const update: {
      streak: number;
      streak_protection_period?: string;
      streak_protection_used?: number;
    } = { streak: updatedStreak };
    if (protectionApplied) {
      update.streak_protection_period = currentPeriod;
      update.streak_protection_used = usedThisPeriod + 1;
    }

    await svc.from('profiles').update(update).eq('id', userId);
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
    previous_streak: currentStreak,
    // True only when a give-in was softened by premium Streak Protection
    // (streak halved) instead of a full reset — lets the client show
    // "streak dropped to X" rather than "streak reset to 0". False once
    // the monthly cap is spent, even for a premium user.
    streak_protected: protectionApplied,
    newly_unlocked_ranks: newlyUnlocked,
  });
});
