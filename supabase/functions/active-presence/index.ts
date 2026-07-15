/**
 * active-presence — live count of *other* users currently in an
 * active craving session.
 *
 * Design:
 *   - JWT-required. The client-side polling belongs to the active
 *     session screen, which only mounts for authenticated users.
 *   - Excludes the caller from the count (Faz 7 karar #1). Server
 *     enforces the filter via `user_id != auth.uid()` so a bad
 *     client can't reveal the true total.
 *   - Excludes stale sessions older than
 *     PRESENCE_ACTIVE_WINDOW_MINUTES to filter force-quits and
 *     crashes without a resolve.
 *
 * Response:
 *   200 { count: number }        // count of OTHER users
 *   401                          // no bearer / bad JWT
 *
 * Deploy: `supabase functions deploy active-presence`
 */

// @ts-expect-error — Deno resolves this from its runtime, not npm.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Kept in sync with constants/presence.ts on the client. Both sides
// must agree on the "stale" cutoff or the count won't match the
// UX copy ("resisting right now").
const ACTIVE_WINDOW_MINUTES = 120;

const jsonHeaders: Record<string, string> = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // Auth check — same shape as resolve-craving.
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const jwt = authHeader.slice('Bearer '.length);

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await anonClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const userId = userData.user.id;

  // Service role bypasses RLS so we can count sessions across all
  // users — the counter would be uselessly self-scoped otherwise.
  // The `user_id != userId` filter is what makes it safe: we only
  // aggregate, never expose row identities.
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const cutoffISO = new Date(
    Date.now() - ACTIVE_WINDOW_MINUTES * 60_000
  ).toISOString();

  // `head: true` + `count: 'exact'` returns just the aggregate,
  // no row data over the wire.
  const { count, error } = await svc
    .from('craving_sessions')
    .select('user_id', { count: 'exact', head: true })
    .eq('status', 'active')
    .neq('user_id', userId)
    .gte('started_at', cutoffISO);

  if (error) {
    console.error('[active-presence] count query failed', error);
    return jsonResponse({ error: 'count_failed' }, 500);
  }

  // NOTE: `count` here is the row count, not distinct-user count.
  // The active-session INSERT is one row per active session and the
  // partial unique index on (user_id) where status='active' enforces
  // at most one active row per user, so row count === distinct-user
  // count in practice. If that invariant ever loosens we'll need to
  // switch to a DISTINCT aggregate (or an rpc).
  return jsonResponse({ count: count ?? 0 });
});
