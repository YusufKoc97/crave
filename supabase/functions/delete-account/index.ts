/**
 * delete-account — irreversible account erasure.
 *
 * Deleting a Supabase user is a service-role-only operation
 * (`auth.admin.deleteUser`), so it cannot live in the client. This
 * endpoint is the whole erasure path.
 *
 * WHY THE EXPLICIT TABLE DELETES:
 *
 * Every FK we can actually read declares ON DELETE CASCADE, so in
 * principle deleting the auth user is enough. Migrations 001 and 002
 * — the ones that created `profiles`, `user_addictions` and
 * `craving_sessions` — are NOT in version control, so their
 * constraints couldn't be confirmed from the repo. Queried directly
 * against production instead: every FK into `auth.users` is already
 * ON DELETE CASCADE (verified via pg_constraint). This purge is kept
 * anyway as the belt to that suspenders — the guarantee comes from
 * checking the live DB, not from trusting an unreadable migration.
 *
 * If a future schema change ever regresses one of these to NO ACTION,
 * `deleteUser` fails on a FK violation and the user would be told
 * their account is gone while it is entirely intact. So we clear the
 * tables ourselves, children first, and only then remove the auth row.
 *
 * `craving_session_triggers` has no user_id — it hangs off
 * craving_sessions(session_id) — so it is deleted by session id
 * lookup before the sessions themselves go.
 *
 * Request (POST, JWT-auth):
 *   { confirm: 'DELETE' }   // guards against a stray invoke
 *
 * Response:
 *   200 { deleted: true, warnings? } — warnings lists any row-purge
 *       that failed but did not block the account removal (see below).
 *   400 confirmation_required
 *   401 unauthorized
 *   500 { error: 'delete_failed', stage } — stage names the step that
 *       broke so a support ticket doesn't start from zero.
 *
 * WHY ROW PURGES ARE NON-FATAL:
 *
 * A row-delete failing on some table (renamed, dropped, RLS surprise)
 * must not turn into every future deletion 500ing at that one step
 * forever with nothing to reveal why. So a failed row purge is
 * collected as a warning and we press on: the auth-row delete is the
 * SOLE arbiter of success. If the cascades are right, the leftover
 * rows die with the auth row; if they aren't, the FK violation
 * surfaces on the fatal auth step with a real Postgres code instead
 * of being masked three steps earlier.
 *
 * Deploy: `supabase functions deploy delete-account`
 */

// @ts-expect-error — Deno resolves this from its runtime, not npm.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const jsonHeaders: Record<string, string> = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  // Deliberately wider than the other three functions
  // ('authorization, content-type'). supabase-js sets `apikey` and
  // `x-client-info` unconditionally; on the web build those trip the
  // CORS preflight, and a destructive action failing at preflight
  // produces a FunctionsFetchError with NO server log — exactly the
  // silent mode this whole endpoint exists to avoid. RN's fetch
  // doesn't preflight, so this only matters on web, but the cost of
  // listing them is nil.
  'access-control-allow-headers':
    'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

/**
 * Tables keyed directly by user_id, ordered so that anything holding a
 * reference is emptied before the thing it references.
 */
const USER_KEYED_TABLES = [
  'technique_uses',
  'user_unlocked_ranks',
  'user_addiction_scores',
  'rate_limits',
  'craving_sessions',
  'user_addictions',
] as const;

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

  // The account being deleted is always the caller's own. There is no
  // user_id in the body precisely so that a leaked JWT can't be aimed
  // at somebody else's account.
  let body: { confirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  if (body.confirm !== 'DELETE') {
    return jsonResponse({ error: 'confirmation_required' }, 400);
  }

  // Every row purge below is best-effort. A failure is recorded here
  // and the erasure continues; only the auth-row delete can fail the
  // request. See the header comment for why.
  const warnings: string[] = [];

  // ─── 1. Trigger tags (no user_id — reached via session ids) ───
  const { data: sessionRows, error: sessionListErr } = await svc
    .from('craving_sessions')
    .select('id')
    .eq('user_id', userId);

  if (sessionListErr) {
    console.warn('[delete-account] session lookup failed', sessionListErr);
    warnings.push('session_lookup');
  }

  const sessionIds = (sessionRows ?? []).map((r: { id: string }) => r.id);
  if (sessionIds.length > 0) {
    // Chunked: a long-lived account can hold thousands of sessions and
    // PostgREST puts the id list in the URL, which has a length limit.
    const CHUNK = 200;
    for (let i = 0; i < sessionIds.length; i += CHUNK) {
      const { error: trigErr } = await svc
        .from('craving_session_triggers')
        .delete()
        .in('session_id', sessionIds.slice(i, i + CHUNK));
      if (trigErr) {
        console.warn('[delete-account] trigger delete failed', trigErr);
        warnings.push('craving_session_triggers');
        break;
      }
    }
  }

  // ─── 2. Everything keyed by user_id ───
  for (const table of USER_KEYED_TABLES) {
    const { error } = await svc.from(table).delete().eq('user_id', userId);
    if (error) {
      console.warn(`[delete-account] ${table} delete failed`, error);
      warnings.push(table);
    }
  }

  // ─── 3. profiles (keyed on `id`, not `user_id`) ───
  const { error: profileErr } = await svc
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (profileErr) {
    console.warn('[delete-account] profiles delete failed', profileErr);
    warnings.push('profiles');
  }

  // ─── 4. The auth row itself — the only fatal step ───
  // Everything above is idempotent, so a client retry after a failure
  // here re-runs harmlessly. If a non-cascading FK is still pointing
  // at this user, THIS is where it surfaces (SQLSTATE 23503), with a
  // real Postgres error — not silently swallowed three steps earlier.
  const { error: authErr } = await svc.auth.admin.deleteUser(userId);
  if (authErr) {
    console.error('[delete-account] auth delete failed', authErr);
    return jsonResponse({ error: 'delete_failed', stage: 'auth_user' }, 500);
  }

  // ─── 5. Verify the row is actually gone ───
  // `deleteUser` returning no error is not proof on its own; a stray
  // success with a surviving row is the single worst outcome (user
  // told they're erased, account intact). One cheap read closes it.
  const { data: check } = await svc.auth.admin.getUserById(userId);
  if (check?.user) {
    console.error(`[delete-account] user still present after delete=${userId}`);
    return jsonResponse({ error: 'delete_failed', stage: 'verify' }, 500);
  }

  console.log(
    `[delete-account] erased user=${userId} warnings=${warnings.length}`
  );
  return jsonResponse(
    warnings.length > 0 ? { deleted: true, warnings } : { deleted: true }
  );
});
