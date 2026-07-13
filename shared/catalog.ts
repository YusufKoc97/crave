/**
 * Cross-runtime catalog whitelist. The client's authoritative catalog
 * (with names, colors, i18n keys) lives at `constants/addictions.ts`;
 * this file mirrors only the id → sensitivity map so the Edge Function
 * can validate an addiction_id without pulling react-native imports.
 *
 * KEEP IN SYNC WITH `constants/addictions.ts`. If you touch either
 * side, touch both.
 *
 * Two responsibilities:
 *   1. Verify `addiction_id` is a member of the fixed 10-item catalog
 *      (defence-in-depth on top of the DB CHECK constraint).
 *   2. Provide a fallback sensitivity value when a legacy row is
 *      missing its snapshot. Live sessions always store their
 *      sensitivity SNAPSHOT at insert time; the catalog value is a
 *      safety net, not the primary source.
 */

export const CATALOG_SENSITIVITY: Record<string, number> = {
  nicotine: 8,
  alcohol: 8,
  caffeine: 5,
  vape: 7,
  gambling: 8,
  junk_food: 7,
  shopping: 6,
  pmo: 8,
  doomscroll: 6,
  gaming: 6,
};

export function isKnownAddiction(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(CATALOG_SENSITIVITY, id);
}

export function catalogSensitivity(id: string): number | null {
  return CATALOG_SENSITIVITY[id] ?? null;
}
