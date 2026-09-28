/**
 * submit-feedback — the "Report a problem" write path.
 *
 * The feedback table (migration 015) has RLS on with no client
 * policies, so — exactly like craving_sessions — the client cannot
 * INSERT directly. This endpoint is the only writer, running under the
 * service role, which is also the only context that can call
 * `bump_rate_limit` (service-role-only EXECUTE). That co-location is
 * the point: the rate limit is unbypassable by a modified client.
 *
 * Two buckets, both fail-closed:
 *   - hourly: MAX_PER_HOUR submissions per UTC hour
 *   - daily:  MAX_PER_DAY submissions per UTC day
 * A signed-in human reporting bugs never approaches these; a script
 * spamming the table hits them immediately.
 *
 * Request (POST, JWT-auth):
 *   {
 *     message: string,          // 10..2000 chars
 *     category?: 'bug'|'idea'|'other',   // defaults to 'other'
 *     app_version?: string,     // client build, <= 32 chars
 *     platform?: 'ios'|'android'|'web'
 *   }
 *
 * Response:
 *   200 { ok: true }
 *   400 { error: 'invalid_json' | 'message_too_short' | 'message_too_long'
 *                | 'invalid_category' }
 *   401 { error: 'unauthorized' }
 *   429 { error: 'rate_limited', retry_after_seconds }
 *   503 { error: 'rate_limit_unavailable' }  — limiter down, fail closed
 *   500 { error: 'insert_failed' }
 *
 * Deploy: `supabase functions deploy submit-feedback`
 */

// @ts-expect-error — Deno resolves this from its runtime, not npm.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Kept in lockstep with the CHECK constraints in migration 015 and
 *  the client-side limits in lib/feedback.ts. */
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;
const MAX_PER_HOUR = 3;
const MAX_PER_DAY = 10;
const CATEGORIES = ['bug', 'idea', 'other'] as const;
const PLATFORMS = ['ios', 'android', 'web'] as const;

const jsonHeaders: Record<string, string> = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function secondsToNextHour(now: Date): number {
  return 3600 - (now.getUTCMinutes() * 60 + now.getUTCSeconds());
}

function secondsToNextDay(now: Date): number {
  return (
    86400 -
    (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds())
  );
}

function utcHourBucket(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}`;
}

function utcDayBucket(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

  // ─── Parse + validate ───
  let body: {
    message?: unknown;
    category?: unknown;
    app_version?: unknown;
    platform?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length < MESSAGE_MIN) {
    return jsonResponse({ error: 'message_too_short' }, 400);
  }
  if (message.length > MESSAGE_MAX) {
    return jsonResponse({ error: 'message_too_long' }, 400);
  }

  let category: string = 'other';
  if (body.category !== undefined) {
    if (
      typeof body.category !== 'string' ||
      !CATEGORIES.includes(body.category as (typeof CATEGORIES)[number])
    ) {
      return jsonResponse({ error: 'invalid_category' }, 400);
    }
    category = body.category;
  }

  // Context fields are best-effort: an invalid value is dropped, not a
  // 400 — a garbled build string must never block a real bug report.
  const appVersion =
    typeof body.app_version === 'string' && body.app_version.length <= 32
      ? body.app_version
      : null;
  const platform =
    typeof body.platform === 'string' &&
    PLATFORMS.includes(body.platform as (typeof PLATFORMS)[number])
      ? body.platform
      : null;

  // ─── Rate limit (fail closed, both buckets) ───
  const now = new Date();
  const hourBucket = utcHourBucket(now);
  const dayBucket = utcDayBucket(now);

  const { data: hourCount, error: hourErr } = await svc.rpc('bump_rate_limit', {
    p_user: userId,
    p_endpoint: 'submit-feedback',
    p_bucket: hourBucket,
    p_amount: 1,
  });
  if (hourErr) {
    console.error('[submit-feedback] hourly rate limit failed', hourErr);
    return jsonResponse({ error: 'rate_limit_unavailable' }, 503);
  }
  if ((hourCount ?? 0) > MAX_PER_HOUR) {
    return jsonResponse(
      { error: 'rate_limited', retry_after_seconds: secondsToNextHour(now) },
      429
    );
  }

  const { data: dayCount, error: dayErr } = await svc.rpc('bump_rate_limit', {
    p_user: userId,
    p_endpoint: 'submit-feedback-day',
    p_bucket: dayBucket,
    p_amount: 1,
  });
  if (dayErr) {
    console.error('[submit-feedback] daily rate limit failed', dayErr);
    return jsonResponse({ error: 'rate_limit_unavailable' }, 503);
  }
  if ((dayCount ?? 0) > MAX_PER_DAY) {
    return jsonResponse(
      { error: 'rate_limited', retry_after_seconds: secondsToNextDay(now) },
      429
    );
  }

  // ─── Insert ───
  const { error: insertErr } = await svc.from('feedback').insert({
    user_id: userId,
    message,
    category,
    app_version: appVersion,
    platform,
  });
  if (insertErr) {
    console.error('[submit-feedback] insert failed', insertErr);
    return jsonResponse({ error: 'insert_failed' }, 500);
  }

  return jsonResponse({ ok: true });
});
