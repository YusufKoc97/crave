/**
 * Faz 8a — trigger-map tuning knobs (heatmap + peak hours +
 * trigger distribution). Insights (Section 1) land in Faz 8b so
 * nothing in this file speaks to rules.
 *
 * Grid orientation: 7 columns (Mon…Sun) × 24 rows (hours 0–23).
 * The array shape returned by the Edge Function mirrors this:
 *   heatmap[day][hour] = number
 * where day is 0=Monday … 6=Sunday (ISO week).
 */

export const DAYS_IN_WEEK = 7;
export const HOURS_IN_DAY = 24;

export type PeriodKey = '7d' | '30d' | 'all';

export const DEFAULT_PERIOD: PeriodKey = '30d';

export const PERIOD_ORDER: readonly PeriodKey[] = ['7d', '30d', 'all'] as const;

/**
 * Cravings needed before each section transitions from
 * placeholder to real data. Empty state → sparse → full.
 * Insights (Section 1) uses these thresholds too when Faz 8b
 * lands.
 */
export const CRAVING_THRESHOLD_SPARSE = 1; // 1+ enough for sparse heatmap
export const CRAVING_THRESHOLD_FULL = 6; // 6+ shows Peak Hours + Distribution
export const CRAVING_THRESHOLD_DETAILED = 20; // 20+ unlocks specific insights (8b)

/**
 * Client-side stale time for the trigger-map response.
 * React Query keeps the previous result usable while a fresh
 * fetch is in flight, so the UI never blanks unless the user
 * changes the period filter.
 */
export const TRIGGER_MAP_STALE_MS = 5 * 60_000;

/**
 * Heatmap colour ramp — five buckets from empty to hottest.
 * Chosen from the indigo/purple family so it slots into the
 * app's dark palette without introducing a new hue axis.
 * Cells with a high average intensity (see `intensity_map`
 * response field) draw an extra top-right dot overlay in a
 * warmer shade so the "how hard" signal reads on top of the
 * "how often" one.
 */
export const HEATMAP_COLORS = [
  '#0A1628', // empty (0)
  '#1B2F5C', // 1
  '#3B4DB4', // 2
  '#7E57C2', // 3-4
  '#B39DDB', // 5+
] as const;

/** Threshold buckets aligned with HEATMAP_COLORS above. */
export function heatmapColor(count: number): string {
  if (count <= 0) return HEATMAP_COLORS[0];
  if (count === 1) return HEATMAP_COLORS[1];
  if (count === 2) return HEATMAP_COLORS[2];
  if (count <= 4) return HEATMAP_COLORS[3];
  return HEATMAP_COLORS[4];
}

/** 1-based day labels ordered Mon…Sun. Client resolves via i18n. */
export const DAY_KEYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

export type DayKey = (typeof DAY_KEYS)[number];
