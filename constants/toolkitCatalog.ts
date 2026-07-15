import { t } from '@/lib/i18n';

/**
 * Faz 6 — Craving Toolkit catalog.
 *
 * Four MVP techniques, all shared across every addiction (no
 * addiction-specific set in v1). Structure only — every visible
 * string comes from i18n (`toolkit.techniques.<id>.*`).
 *
 * `durationSeconds` is the guided-flow length the technique
 * screens use to lay out timelines. Card UI shows it as minutes
 * (rounded up); the running screen displays seconds per phase.
 *
 * Client-only. No shared/ mirror because the Edge Function doesn't
 * touch technique data — writes to `technique_uses` are
 * client-authored with RLS.
 */

export type TechniqueType =
  | 'breathing'
  | 'mindfulness'
  | 'grounding'
  | 'body_scan';

export type Technique = {
  id: string;
  type: TechniqueType;
  durationSeconds: number;
  emoji: string;
  displayOrder: number;
};

export const TOOLKIT_TECHNIQUES: readonly Technique[] = [
  // 4 cycles × 19s (4-in / 7-hold / 8-out) = 76s
  {
    id: 'breathing_478',
    type: 'breathing',
    durationSeconds: 76,
    emoji: '🫁',
    displayOrder: 1,
  },
  // 5 min mindfulness — standard urge-surfing duration
  {
    id: 'urge_surfing',
    type: 'mindfulness',
    durationSeconds: 300,
    emoji: '🌊',
    displayOrder: 2,
  },
  // 3 min sensory grounding (5→4→3→2→1)
  {
    id: 'grounding_54321',
    type: 'grounding',
    durationSeconds: 180,
    emoji: '🖐️',
    displayOrder: 3,
  },
  // 8 regions × 45s = 360s (6 min short body scan)
  {
    id: 'body_scan',
    type: 'body_scan',
    durationSeconds: 360,
    emoji: '🧘',
    displayOrder: 4,
  },
] as const;

/** Fast id → technique lookup for modal routing. */
const BY_ID: Record<string, Technique> = TOOLKIT_TECHNIQUES.reduce(
  (acc, tech) => {
    acc[tech.id] = tech;
    return acc;
  },
  {} as Record<string, Technique>
);

export function getTechnique(id: string): Technique | undefined {
  return BY_ID[id];
}

/** i18n-resolved name for a technique row. */
export function techniqueName(tech: Technique): string {
  return t(`toolkit.techniques.${tech.id}.name`);
}

/** i18n-resolved short (card) description. */
export function techniqueShortDescription(tech: Technique): string {
  return t(`toolkit.techniques.${tech.id}.short_description`);
}

/** i18n-resolved long (info) description. */
export function techniqueLongDescription(tech: Technique): string {
  return t(`toolkit.techniques.${tech.id}.long_description`);
}

/**
 * "N min" label for cards + list views. Rounds up so a 76s
 * technique shows "2 min" rather than "1 min" — closer to what the
 * user will actually spend.
 */
export function techniqueDurationLabel(tech: Technique): string {
  const minutes = Math.max(1, Math.ceil(tech.durationSeconds / 60));
  return t('toolkit.duration_minutes', { minutes });
}

/** Feedback ratings persisted to technique_uses.feedback. */
export type TechniqueFeedback = 'much_better' | 'better' | 'same' | 'worse';

export const FEEDBACK_OPTIONS: readonly {
  id: TechniqueFeedback;
  emoji: string;
  labelKey: string;
}[] = [
  { id: 'much_better', emoji: '😌', labelKey: 'toolkit.feedback.much_better' },
  { id: 'better', emoji: '😊', labelKey: 'toolkit.feedback.better' },
  { id: 'same', emoji: '😐', labelKey: 'toolkit.feedback.same' },
  { id: 'worse', emoji: '😞', labelKey: 'toolkit.feedback.worse' },
] as const;

/** Where in the app the technique was launched from — persisted
 *  as `context` on technique_uses so Modül 3 can slice "did they
 *  reach for it preventively or reactively?". */
export type TechniqueContext = 'active_craving' | 'info_tab';
