import type { PeriodKey } from '@/constants/heatmap';
import type { TriggerMapResponse } from '@/lib/triggerMap';

/**
 * TEMP-TRIGGER-MOCK-DATA — 2026-07-21
 * -----------------------------------------------------------------
 * Design-preview mock data for the Triggers sub-tab.
 *
 * The pane is a pure renderer over the Edge Function response, but
 * during design polish the test user has 0 cravings so every card
 * lands in the empty state. This module fabricates a plausible full
 * dataset per period so we can iterate on hero / heatmap / peak
 * clock / distribution visuals without seeding the DB.
 *
 * Three period-specific variants so the 7d / 30d / all pills feel
 * like real filters — heatmap density, peak counts, and total
 * craving_count all shift with the selection.
 *
 * REMOVE BEFORE SHIP: grep for TEMP-TRIGGER-MOCK-DATA and rip out
 * the import + fallback in TriggersPane.tsx. The Edge Function is
 * still the source of truth and the fallback only fires when the
 * query returns no data (isZero) — real users are unaffected the
 * moment they log a single craving.
 * -----------------------------------------------------------------
 */

/**
 * Base weekly pattern — evening cluster on weekdays + weekend
 * afternoons. Different periods scale this pattern up/down and
 * shift which days are populated (7d = only current week partial).
 */
function scaledHeatmap(scale: number, sparsityFactor = 1): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );
  const put = (d: number, h: number, base: number) => {
    const v = Math.max(0, Math.round(base * scale));
    if (v > 0 && Math.random() * sparsityFactor <= 1) grid[d][h] = v;
    else grid[d][h] = v;
  };
  // Monday morning peak
  put(0, 8, 3);
  put(0, 9, 4);
  // Tuesday evening peak (usually the strongest)
  put(1, 19, 3);
  put(1, 20, 5);
  put(1, 21, 4);
  // Wed/Thu supporting evenings
  put(2, 19, 2);
  put(2, 20, 3);
  put(2, 21, 2);
  put(3, 20, 3);
  put(3, 21, 4);
  // Friday evening peak
  put(4, 20, 3);
  put(4, 21, 5);
  put(4, 22, 4);
  // Weekend afternoons
  put(5, 14, 2);
  put(5, 15, 3);
  put(5, 16, 2);
  put(6, 15, 3);
  put(6, 16, 2);
  // Late Sunday scroll
  put(6, 22, 2);
  put(6, 23, 3);
  // Sparse mid-mornings
  put(1, 10, 1);
  put(2, 11, 2);
  put(3, 9, 1);
  return grid;
}

/** Only Mon-Wed present in the 7d view (partial current week). */
function scaledHeatmap7d(): number[][] {
  const grid = scaledHeatmap(0.6);
  // Clear Thu-Sun for the 7d view — only the current partial week
  // (Mon-Wed today) shows up in the last 7 days of activity.
  for (let d = 3; d < 7; d++) {
    for (let h = 0; h < 24; h++) grid[d][h] = 0;
  }
  return grid;
}

function scaledIntensity(scale: number): (number | null)[][] {
  const grid: (number | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => null)
  );
  const set = (d: number, h: number, level: number) => {
    grid[d][h] = Math.min(5, Math.max(1, Math.round(level * scale)));
  };
  set(1, 20, 5);
  set(1, 21, 4);
  set(4, 21, 5);
  set(4, 22, 4);
  set(0, 9, 4);
  set(3, 21, 4);
  set(6, 23, 4);
  set(2, 20, 3);
  set(5, 15, 3);
  return grid;
}

const MOCK_7D: TriggerMapResponse = {
  cravings_count: 11,
  heatmap: scaledHeatmap7d(),
  intensity_map: scaledIntensity(1),
  peak_hours: [
    { day: 1, hour: 20, count: 5 }, // Tue 7-10 PM
    { day: 0, hour: 9, count: 3 }, // Mon 8-10 AM
    { day: 2, hour: 20, count: 3 }, // Wed 7-10 PM
  ],
  triggers: [
    {
      trigger_id: 'stress',
      count: 5,
      percentage: 45,
      most_common_intensity: 'strong',
    },
    {
      trigger_id: 'tiredness',
      count: 3,
      percentage: 27,
      most_common_intensity: 'moderate',
    },
    {
      trigger_id: 'boredom',
      count: 2,
      percentage: 18,
      most_common_intensity: 'mild',
    },
    {
      trigger_id: 'loneliness',
      count: 1,
      percentage: 10,
      most_common_intensity: 'mild',
    },
  ],
  insights: [
    {
      rule_id: 'peak_hour',
      category: 'time',
      priority: 85,
      templateKey: 'insights.peak_hour.template',
      interpolation: { hour: '20:00', count: 5 },
      detailKey: 'insights.peak_hour.detail',
    },
    {
      rule_id: 'dominant_trigger',
      category: 'trigger',
      priority: 90,
      templateKey: 'insights.dominant_trigger.template',
      interpolation: { trigger: 'stress', percent: 45 },
      detailKey: 'insights.dominant_trigger.detail',
      actionKey: 'open_toolkit',
    },
  ],
};

const MOCK_30D: TriggerMapResponse = {
  cravings_count: 47,
  heatmap: scaledHeatmap(1),
  intensity_map: scaledIntensity(1),
  peak_hours: [
    { day: 1, hour: 20, count: 12 }, // Tue 7-10 PM
    { day: 4, hour: 21, count: 9 }, // Fri 8-11 PM
    { day: 0, hour: 9, count: 7 }, // Mon 8-10 AM
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

const MOCK_ALL: TriggerMapResponse = {
  cravings_count: 142,
  heatmap: scaledHeatmap(2.6),
  intensity_map: scaledIntensity(1),
  peak_hours: [
    { day: 1, hour: 20, count: 34 }, // Tue 7-10 PM
    { day: 4, hour: 21, count: 27 }, // Fri 8-11 PM
    { day: 6, hour: 23, count: 21 }, // Sun 10 PM-12 AM
  ],
  triggers: [
    {
      trigger_id: 'stress',
      count: 52,
      percentage: 37,
      most_common_intensity: 'strong',
    },
    {
      trigger_id: 'loneliness',
      count: 28,
      percentage: 20,
      most_common_intensity: 'moderate',
    },
    {
      trigger_id: 'boredom',
      count: 22,
      percentage: 15,
      most_common_intensity: 'mild',
    },
    {
      trigger_id: 'tiredness',
      count: 20,
      percentage: 14,
      most_common_intensity: 'moderate',
    },
    {
      trigger_id: 'social_situation',
      count: 12,
      percentage: 8,
      most_common_intensity: 'mild',
    },
    {
      trigger_id: 'anxiety',
      count: 8,
      percentage: 6,
      most_common_intensity: 'strong',
    },
  ],
  insights: [
    {
      rule_id: 'dominant_trigger',
      category: 'trigger',
      priority: 90,
      templateKey: 'insights.dominant_trigger.template',
      interpolation: { trigger: 'stress', percent: 37 },
      detailKey: 'insights.dominant_trigger.detail',
      actionKey: 'open_toolkit',
    },
    {
      rule_id: 'rising_resistance',
      category: 'trend',
      priority: 75,
      templateKey: 'insights.rising_resistance.template',
      interpolation: { percent: 18 },
      detailKey: 'insights.rising_resistance.detail',
    },
    {
      rule_id: 'weekend_concentration',
      category: 'time',
      priority: 70,
      templateKey: 'insights.weekend_concentration.template',
      interpolation: { multiplier: '1.8' },
      detailKey: 'insights.weekend_concentration.detail',
    },
  ],
};

/** Return the mock dataset appropriate for the selected period. */
export function mockTriggerMapFor(period: PeriodKey): TriggerMapResponse {
  switch (period) {
    case '7d':
      return MOCK_7D;
    case 'all':
      return MOCK_ALL;
    case '30d':
    default:
      return MOCK_30D;
  }
}
