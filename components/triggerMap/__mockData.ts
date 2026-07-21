import type { TriggerMapResponse } from '@/lib/triggerMap';

/**
 * TEMP-TRIGGER-MOCK-DATA — 2026-07-21
 * -----------------------------------------------------------------
 * Design-preview mock data for the Triggers sub-tab.
 *
 * The pane is a pure renderer over the Edge Function response, but
 * during design polish the test user has 0 cravings so every card
 * lands in the empty state. This module fabricates a plausible full
 * dataset so we can iterate on hero / heatmap / peak clock /
 * distribution visuals without seeding the DB.
 *
 * REMOVE BEFORE SHIP: grep for TEMP-TRIGGER-MOCK-DATA and rip out
 * the import + fallback in TriggersPane.tsx. The Edge Function is
 * still the source of truth and the fallback only fires when the
 * query returns no data (isZero) — real users are unaffected the
 * moment they log a single craving.
 * -----------------------------------------------------------------
 */

/** A deterministic 7×24 heatmap with realistic hotspots that
 *  match the three peak windows listed below. */
function makeMockHeatmap(): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );
  // Monday morning peak (rank 3): 8-10 AM
  grid[0][8] = 3;
  grid[0][9] = 4;
  // Tuesday evening peak (rank 1): 7-10 PM
  grid[1][19] = 3;
  grid[1][20] = 5;
  grid[1][21] = 4;
  // Wednesday-Thursday evenings — supporting evening cluster
  grid[2][19] = 2;
  grid[2][20] = 3;
  grid[2][21] = 2;
  grid[3][20] = 3;
  grid[3][21] = 4;
  // Friday evening peak (rank 2): 8-11 PM
  grid[4][20] = 3;
  grid[4][21] = 5;
  grid[4][22] = 4;
  // Weekend afternoons — some ambient warmth
  grid[5][14] = 2;
  grid[5][15] = 3;
  grid[5][16] = 2;
  grid[6][15] = 3;
  grid[6][16] = 2;
  // Late Sunday scroll
  grid[6][22] = 2;
  grid[6][23] = 3;
  // Sparse mid-mornings
  grid[1][10] = 1;
  grid[2][11] = 2;
  grid[3][9] = 1;
  return grid;
}

/** Matching intensity_map with strong intensities on the hotspots. */
function makeMockIntensity(): (number | null)[][] {
  const grid: (number | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => null)
  );
  // Peak-window intensities (strong = white dot on cell)
  grid[1][20] = 5;
  grid[1][21] = 4;
  grid[4][21] = 5;
  grid[4][22] = 4;
  grid[0][9] = 4;
  grid[3][21] = 4;
  grid[6][23] = 4;
  // Softer cells with moderate intensity
  grid[2][20] = 3;
  grid[5][15] = 3;
  return grid;
}

export const MOCK_TRIGGER_MAP: TriggerMapResponse = {
  cravings_count: 47,
  heatmap: makeMockHeatmap(),
  intensity_map: makeMockIntensity(),
  // Peaks intentionally chosen to line up with cells in the mock
  // heatmap so the PeakHoursList mini-histograms show real weight
  // when derived from `heatmap[day]`.
  peak_hours: [
    { day: 1, hour: 20, count: 12 }, // Tue 7-10 PM window
    { day: 4, hour: 21, count: 9 }, // Fri 8-11 PM window
    { day: 0, hour: 9, count: 7 }, // Mon 8-10 AM window
  ],
  triggers: [
    {
      trigger_id: 'stress',
      count: 18,
      percentage: 38,
      most_common_intensity: 'strong',
    },
    {
      trigger_id: 'loneliness',
      count: 10,
      percentage: 22,
      most_common_intensity: 'moderate',
    },
    {
      trigger_id: 'boredom',
      count: 7,
      percentage: 15,
      most_common_intensity: 'mild',
    },
    {
      trigger_id: 'tiredness',
      count: 6,
      percentage: 12,
      most_common_intensity: 'moderate',
    },
    {
      trigger_id: 'social_situation',
      count: 4,
      percentage: 8,
      most_common_intensity: 'mild',
    },
  ],
  insights: [
    {
      rule_id: 'dominant_trigger',
      category: 'trigger',
      priority: 90,
      templateKey: 'insights.dominant_trigger.template',
      interpolation: { trigger: 'stress', percent: 38 },
      detailKey: 'insights.dominant_trigger.detail',
      actionKey: 'open_toolkit',
    },
    {
      rule_id: 'peak_hour',
      category: 'time',
      priority: 85,
      templateKey: 'insights.peak_hour.template',
      interpolation: { hour: '21:00', count: 6 },
      detailKey: 'insights.peak_hour.detail',
    },
    {
      rule_id: 'effective_technique',
      category: 'technique',
      priority: 80,
      templateKey: 'insights.effective_technique.template',
      interpolation: { technique: 'breathing_478', percent: 83 },
      detailKey: 'insights.effective_technique.detail',
      actionKey: 'open_toolkit',
    },
  ],
};
