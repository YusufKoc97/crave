/**
 * comparison-data — community-comparison aggregation for the Info
 * tab's Comparison sub-tab.
 *
 * Unlike `trigger-map-data` (which reads ONLY the caller's own rows),
 * this endpoint aggregates the WHOLE cohort for one addiction — every
 * user's resolved sessions — so it can place the caller on a
 * community curve. That cross-user read is exactly why it must run
 * server-side under the service role: RLS on `craving_sessions` is
 * owner-only, so a client can never assemble a cohort itself.
 *
 * The response carries AGGREGATES ONLY — never a per-user row or a
 * user_id. `computeComparison()` (shared/comparisonStats.ts) reduces
 * the raw rows into percentile / distribution / pulse / patterns
 * numbers; the caller's own id is used solely to locate their slice.
 *
 * Privacy + honesty guards live in the shared module, not here:
 *   - cohort < MIN_COHORT_USERS → state 'launch' (no real numbers).
 *   - requester < MIN_SESSIONS_TO_PLACE → state 'lowdata'.
 *
 * Label mapping (trigger_id / technique_id → display text) is the
 * client's job — this function emits ids + numbers, matching how the
 * Triggers pane maps ids. The client hook turns this into the
 * `ComparisonData` render shape (labels, icons, formatted deltas).
 *
 * Request:
 *   POST { addiction_id: string }
 *
 * Response (ComparisonStatsResult):
 *   { state, cohortUsers, pulse, distribution, standing, patterns }
 *
 * Auth: JWT required (Bearer).
 */

// @ts-expect-error — Deno resolves this from its runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  computeComparison,
  type CohortSession,
  type CohortTechRow,
  type CohortTriggerRow,
} from '../../../shared/comparisonStats.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

/**
 * Cohort-wide row ceiling. This is a whole-community scan, so it is
 * far larger than `trigger-map-data`'s per-user cap — but still bounded
 * so the isolate can't be forced to materialise an unbounded table.
 * Rows are pulled newest-first, so if the cohort ever exceeds this the
 * curve is built from the most recent activity (and we log the cap).
 * Pre-launch this is never hit; revisit with a windowed query at scale.
 */
const MAX_ROWS = 20000;

/**
 * Cap on distinct session ids we look up triggers for. Triggers only
 * feed the trailing-week Pulse, so we only ever fetch them for the
 * week's sessions — but we still bound the `.in()` list defensively.
 */
const MAX_WEEK_TRIGGER_IDS = 5000;

const WEEK_MS = 7 * 24 * 60 * 60_000;

const jsonHeaders: Record<string, string> = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

const VALID_ADDICTIONS = new Set([
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
]);

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

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await anonClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const userId = userData.user.id;

  let body: { addiction_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const addictionId =
    typeof body.addiction_id === 'string' ? body.addiction_id : '';
  if (!VALID_ADDICTIONS.has(addictionId)) {
    return jsonResponse({ error: 'invalid_addiction' }, 400);
  }

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Cohort sessions: EVERY user's resolved rows for this addiction ──
  // Deliberately NOT filtered by user_id — this is the cross-user read
  // the whole endpoint exists for. Newest-first so the MAX_ROWS cap, if
  // ever hit, keeps the freshest slice of the community.
  const { data: sessions, error: sessionsErr } = await svc
    .from('craving_sessions')
    .select('id, user_id, outcome, duration_seconds, started_at')
    .eq('addiction_id', addictionId)
    .eq('status', 'resolved')
    .order('started_at', { ascending: false })
    .limit(MAX_ROWS);

  if (sessionsErr) {
    console.error('[comparison-data] sessions query failed', sessionsErr);
    return jsonResponse({ error: 'sessions_failed' }, 500);
  }

  const sessionRows = sessions ?? [];
  if (sessionRows.length >= MAX_ROWS) {
    console.warn(
      `[comparison-data] cohort hit MAX_ROWS=${MAX_ROWS} for ${addictionId}; curve built from newest slice`
    );
  }

  const cohortSessions: CohortSession[] = sessionRows.map((s) => ({
    id: s.id as string,
    user_id: s.user_id as string,
    outcome: (s.outcome === 'resisted' ? 'resisted' : 'failed') as
      | 'resisted'
      | 'failed',
    // `duration_seconds` is nullable; a resisted row without a duration
    // contributes 0 to the hold-out average rather than crashing the math.
    duration_seconds:
      typeof s.duration_seconds === 'number' ? s.duration_seconds : 0,
    started_at: s.started_at as string,
  }));

  // ── Triggers: only the trailing-week sessions feed the Pulse ──
  // `computeComparison` uses triggers ONLY for the this-week top-trigger,
  // so we fetch them for week sessions alone — keeps the `.in()` list
  // small even when the cohort's full history is large.
  const nowMs = Date.now();
  const weekCutoff = nowMs - WEEK_MS;
  const weekSessionIds = cohortSessions
    .filter((s) => Date.parse(s.started_at) >= weekCutoff)
    .map((s) => s.id)
    .slice(0, MAX_WEEK_TRIGGER_IDS);

  let cohortTriggers: CohortTriggerRow[] = [];
  if (weekSessionIds.length > 0) {
    const { data: tData, error: tErr } = await svc
      .from('craving_session_triggers')
      .select('session_id, trigger_id')
      .in('session_id', weekSessionIds);
    if (tErr) {
      console.error('[comparison-data] triggers query failed', tErr);
      // Non-fatal: the Pulse simply shows no top trigger.
    } else {
      cohortTriggers = (tData ?? []).map((r) => ({
        session_id: r.session_id as string,
        trigger_id: r.trigger_id as string,
      }));
    }
  }

  // ── Techniques: cohort-wide completed uses for this addiction ──
  // Feeds the "what's working for the community" wave. `technique_uses`
  // carries addiction_id + completed, so no per-session join is needed.
  const { data: techData, error: techErr } = await svc
    .from('technique_uses')
    .select('technique_id, feedback')
    .eq('addiction_id', addictionId)
    .eq('completed', true)
    .limit(MAX_ROWS);
  if (techErr) {
    console.error('[comparison-data] techniques query failed', techErr);
    // Non-fatal: `wave` comes back null when there's no technique data.
  }
  const cohortTechniques: CohortTechRow[] = (techData ?? []).map((r) => ({
    technique_id: r.technique_id as string,
    feedback: (r.feedback === 'much_better' ||
    r.feedback === 'better' ||
    r.feedback === 'same' ||
    r.feedback === 'worse'
      ? r.feedback
      : null) as CohortTechRow['feedback'],
  }));

  const result = computeComparison({
    requesterId: userId,
    sessions: cohortSessions,
    triggers: cohortTriggers,
    techniques: cohortTechniques,
    nowMs,
  });

  return jsonResponse(result);
});
