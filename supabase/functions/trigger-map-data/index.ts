/**
 * trigger-map-data — Faz 8a aggregation for Modül 3.
 *
 * Reads the caller's own `craving_sessions` (+ triggers) for a
 * given addiction over a period window, aggregates them into the
 * three payloads the client's TriggersPane needs:
 *
 *   heatmap[7][24]         — resist-count per (day-of-week, hour)
 *   intensity_map[7][24]   — avg intensity per cell (or null)
 *   peak_hours             — top 3 (day, startHour, endHour, count)
 *   triggers[]             — sorted counts + most-common intensity
 *
 * Insights are deliberately excluded — those land in Faz 8b. The
 * response schema reserves an empty `insights: []` slot so the
 * client can wire the section without a payload migration later.
 *
 * Request:
 *   POST { addiction_id: string, period: '7d' | '30d' | 'all' }
 *
 * Response:
 *   { cravings_count, heatmap, intensity_map, peak_hours,
 *     triggers, insights: [] }
 *
 * Auth: JWT required (Bearer). RLS on craving_sessions still
 * enforces owner-only rows even under the service-role client;
 * we filter by userId explicitly for defence in depth.
 */

// @ts-expect-error — Deno resolves this from its runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

type PeriodKey = '7d' | '30d' | 'all';

function periodCutoffMs(period: PeriodKey): number | null {
  const now = Date.now();
  switch (period) {
    case '7d':
      return now - 7 * 24 * 60 * 60_000;
    case '30d':
      return now - 30 * 24 * 60 * 60_000;
    case 'all':
      return null;
  }
}

/**
 * Convert a JS Date to (day, hour) with day = 0=Monday … 6=Sunday
 * so the client can render Mon…Sun columns without extra math.
 */
function dayHourOf(iso: string): { day: number; hour: number } {
  const d = new Date(iso);
  // getDay(): 0=Sun … 6=Sat. Shift to Mon-based:
  //   Sun (0) → 6 ; Mon (1) → 0 ; … Sat (6) → 5.
  const sunday = d.getDay();
  const day = (sunday + 6) % 7;
  const hour = d.getHours();
  return { day, hour };
}

const INTENSITY_LABELS = [
  'mild',
  'moderate',
  'strong',
  'very_strong',
  'unbearable',
] as const;
type IntensityLabel = (typeof INTENSITY_LABELS)[number];

/** Map 1–5 → label; null → null. */
function labelForIntensity(
  value: number | null | undefined
): IntensityLabel | null {
  if (!value || value < 1 || value > 5) return null;
  return INTENSITY_LABELS[value - 1];
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

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await anonClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const userId = userData.user.id;

  let body: { addiction_id?: unknown; period?: unknown };
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
  const period: PeriodKey =
    body.period === '7d' || body.period === 'all' ? body.period : '30d';

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Fetch resolved sessions for this addiction in-window.
  // Only 'resolved' with an outcome contributes to the map — an
  // 'active' or 'abandoned' row would poison the analytics.
  let sessionsQuery = svc
    .from('craving_sessions')
    .select('id, started_at, outcome, intensity')
    .eq('user_id', userId)
    .eq('addiction_id', addictionId)
    .eq('status', 'resolved');

  const cutoffMs = periodCutoffMs(period);
  if (cutoffMs !== null) {
    sessionsQuery = sessionsQuery.gte(
      'started_at',
      new Date(cutoffMs).toISOString()
    );
  }
  const { data: sessions, error: sessionsErr } = await sessionsQuery;
  if (sessionsErr) {
    console.error('[trigger-map-data] sessions query failed', sessionsErr);
    return jsonResponse({ error: 'sessions_failed' }, 500);
  }

  const sessionRows = sessions ?? [];
  const cravingsCount = sessionRows.length;

  // ── Aggregate: heatmap + intensity_map (per cell average) ──
  // heatmap[day][hour] = count. intensity_map[day][hour] = avg
  // intensity 1-5 (or null when no ratings). We accumulate sums
  // and non-null counts side-by-side then divide at the end.
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );
  const intensitySum: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );
  const intensityCounts: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );

  // Session id → (day, hour) so we can slice triggers into the
  // heatmap detail sheet's "top triggers for this cell" list.
  const sessionCell = new Map<string, { day: number; hour: number }>();

  for (const s of sessionRows) {
    const { day, hour } = dayHourOf(s.started_at);
    heatmap[day][hour] += 1;
    sessionCell.set(s.id, { day, hour });
    if (
      typeof s.intensity === 'number' &&
      s.intensity >= 1 &&
      s.intensity <= 5
    ) {
      intensitySum[day][hour] += s.intensity;
      intensityCounts[day][hour] += 1;
    }
  }

  const intensityMap: (number | null)[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(null)
  );
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (intensityCounts[d][h] > 0) {
        intensityMap[d][h] = intensitySum[d][h] / intensityCounts[d][h];
      }
    }
  }

  // ── Peak Hours (top 3) ──
  // We take the top 3 individual (day, hour) cells rather than
  // synthesizing "windows" — Faz 8a's list is a single hour per
  // row. The client renders "startHour:00–startHour+1:00".
  type Peak = { day: number; hour: number; count: number };
  const flatCells: Peak[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (heatmap[d][h] > 0)
        flatCells.push({ day: d, hour: h, count: heatmap[d][h] });
    }
  }
  flatCells.sort((a, b) => b.count - a.count);
  const peakHours = flatCells.slice(0, 3);

  // ── Trigger distribution ──
  // Pull all trigger rows for these sessions in one round-trip.
  // Client never sees session_id here — only the aggregate.
  let triggerRows: { session_id: string; trigger_id: string }[] = [];
  if (sessionRows.length > 0) {
    const sessionIds = sessionRows.map((s) => s.id);
    const { data: tData, error: tErr } = await svc
      .from('craving_session_triggers')
      .select('session_id, trigger_id')
      .in('session_id', sessionIds);
    if (tErr) {
      console.error('[trigger-map-data] triggers query failed', tErr);
      return jsonResponse({ error: 'triggers_failed' }, 500);
    }
    triggerRows = tData ?? [];
  }

  // trigger_id → count + intensity histogram (bucket by session
  // intensity if present). "Most common intensity" = mode of that
  // histogram, resolved to an i18n-friendly label. Ties resolve to
  // the higher intensity so ambiguous cases lean toward "this was
  // hard" rather than under-representing severity.
  const sessionIntensity = new Map<string, number>();
  for (const s of sessionRows) {
    if (
      typeof s.intensity === 'number' &&
      s.intensity >= 1 &&
      s.intensity <= 5
    ) {
      sessionIntensity.set(s.id, s.intensity);
    }
  }

  const perTrigger = new Map<string, { count: number; buckets: number[] }>();
  for (const row of triggerRows) {
    const existing = perTrigger.get(row.trigger_id) ?? {
      count: 0,
      // Index 0 = intensity 1 (mild) … index 4 = intensity 5.
      buckets: [0, 0, 0, 0, 0],
    };
    existing.count += 1;
    const intensity = sessionIntensity.get(row.session_id);
    if (intensity) existing.buckets[intensity - 1] += 1;
    perTrigger.set(row.trigger_id, existing);
  }

  const totalTriggerHits = triggerRows.length;
  const triggersOut = Array.from(perTrigger.entries())
    .map(([trigger_id, agg]) => {
      // Mode of intensity buckets (ties → higher intensity).
      let bestIdx = -1;
      let bestCount = 0;
      for (let i = 0; i < 5; i++) {
        if (agg.buckets[i] >= bestCount) {
          bestCount = agg.buckets[i];
          bestIdx = i;
        }
      }
      const mostCommonIntensity: IntensityLabel | null =
        bestCount > 0 ? INTENSITY_LABELS[bestIdx] : null;
      const percentage =
        totalTriggerHits > 0
          ? Math.round((agg.count / totalTriggerHits) * 100)
          : 0;
      return {
        trigger_id,
        count: agg.count,
        percentage,
        most_common_intensity: mostCommonIntensity,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Sanity: pack the sessionCell map into the response only if
  // the client asks for a specific cell — currently unused, so we
  // keep the response payload lean.
  void sessionCell;
  void labelForIntensity;

  return jsonResponse({
    cravings_count: cravingsCount,
    heatmap,
    intensity_map: intensityMap,
    peak_hours: peakHours,
    triggers: triggersOut,
    // Faz 8b will populate this; the client already reads
    // `insights ?? []` so a schema mismatch is impossible.
    insights: [],
  });
});
