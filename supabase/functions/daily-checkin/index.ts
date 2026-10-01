/**
 * daily-checkin — server-authoritative "craving-free day" bonus.
 *
 * ONE general bonus per finished day: "yesterday was quiet" is a fact
 * about the person, not about one habit. Its points go to the user's
 * TOTAL (user_total_score = Σ addiction scores + Σ check-ins) and to no
 * single addiction, so per-addiction rank ladders are untouched.
 *
 * The app cannot know whether a quiet day was clean or simply unlogged,
 * so this is a self-report whose payout is deliberately small
 * (shared/scoring.ts CLEAN_DAY_POINTS) and tightly bounded. Everything
 * that limits abuse lives HERE, not in the client:
 *
 *   - the day must be FINISHED in the caller's timezone and no older
 *     than CLEAN_DAY_CLAIM_WINDOW_HOURS;
 *   - the user must be tracking at least one active addiction that was
 *     already added by the end of that day (nothing to stay clean of
 *     before that);
 *   - NO craving session for ANY addiction may exist in that day (a
 *     logged resist already paid; a logged slip is not clean);
 *   - one claim per (user, day) — the daily_checkins primary key, so a
 *     retry can never pay twice;
 *   - all clean-day bonuses together stay under CLEAN_DAY_CAP_RATIO of
 *     the points earned by resisting, so "no cravings" tapped every day
 *     with no real resists behind it pays nothing;
 *   - the hourly rate limit fails closed.
 *
 * Request (POST, JWT-auth):
 *   { day: 'YYYY-MM-DD',
 *     tz_offset_minutes: number }   // JS Date#getTimezoneOffset()
 *
 * Response:
 *   200 { points_delta, total_score, already_claimed? }
 *   400 bad input · 409 { error: 'not_eligible', reason }
 *
 * Deploy: `supabase functions deploy daily-checkin`
 */

// @ts-expect-error — Deno resolves this from its runtime, not npm.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  canAffordCleanDay,
  CLEAN_DAY_CLAIM_WINDOW_HOURS,
  CLEAN_DAY_POINTS,
  isValidDayKey,
  localDayWindow,
  RATE_LIMIT_MAX_PER_HOUR,
} from '../../../shared/scoring.ts';

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
    day?: unknown;
    tz_offset_minutes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

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

  // ─── Must be tracking something, and already have been that day ───
  const { data: tracked, error: trackedErr } = await svc
    .from('user_addictions')
    .select('added_at')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (trackedErr) {
    console.error('[daily-checkin] tracked probe failed', trackedErr);
    return jsonResponse({ error: 'probe_failed' }, 500);
  }
  const trackedByThen = (tracked ?? []).some(
    (r: { added_at: string }) => Date.parse(r.added_at) < endMs
  );
  if (!trackedByThen) return notEligible('not_tracked');

  // ─── Already claimed? (cheap probe before spending rate budget) ───
  const { data: existing } = await svc
    .from('daily_checkins')
    .select('points')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();
  if (existing) return replay(svc, userId);

  // ─── A logged craving that day means it was not a "clean" day ───
  const { count: sessionCount, error: sessErr } = await svc
    .from('craving_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('ended_at', new Date(startMs).toISOString())
    .lt('ended_at', new Date(endMs).toISOString());
  if (sessErr) {
    console.error('[daily-checkin] session probe failed', sessErr);
    return jsonResponse({ error: 'probe_failed' }, 500);
  }
  if ((sessionCount ?? 0) > 0) return notEligible('had_sessions');

  // ─── Bonus cap: clean days can never outgrow real resists ───
  const [scoresRes, bonusRes] = await Promise.all([
    svc.from('user_addiction_scores').select('score').eq('user_id', userId),
    svc.from('daily_checkins').select('points').eq('user_id', userId),
  ]);
  if (scoresRes.error || bonusRes.error) {
    console.error(
      '[daily-checkin] cap probe failed',
      scoresRes.error ?? bonusRes.error
    );
    return jsonResponse({ error: 'probe_failed' }, 500);
  }
  const resistPoints = (scoresRes.data ?? []).reduce(
    (sum: number, r: { score: number }) => sum + (r.score ?? 0),
    0
  );
  const bonusPoints = (bonusRes.data ?? []).reduce(
    (sum: number, r: { points: number }) => sum + (r.points ?? 0),
    0
  );
  if (!canAffordCleanDay(resistPoints, bonusPoints)) {
    return notEligible('cap_reached');
  }

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

  // ─── Claim the day. The PK makes this the idempotency guard. The
  //     bonus lives on this row alone — user_total_score sums it in. ───
  const { error: insertErr } = await svc.from('daily_checkins').insert({
    user_id: userId,
    day,
    points: CLEAN_DAY_POINTS,
  });
  if (insertErr) {
    if ((insertErr as { code?: string }).code === '23505') {
      return replay(svc, userId); // racing double-tap
    }
    console.error('[daily-checkin] insert failed', insertErr);
    return jsonResponse({ error: 'checkin_insert_failed' }, 500);
  }

  return jsonResponse({
    points_delta: CLEAN_DAY_POINTS,
    total_score: await totalScore(svc, userId),
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function totalScore(svc: any, userId: string): Promise<number> {
  const { data } = await svc
    .from('user_total_score')
    .select('total_score')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.total_score ?? 0;
}

/** A day that was already claimed: report success without paying again. */
async function replay(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  userId: string
): Promise<Response> {
  return jsonResponse({
    points_delta: 0,
    total_score: await totalScore(svc, userId),
    already_claimed: true,
  });
}
