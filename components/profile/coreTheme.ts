/**
 * "The Core" — Profile module theme.
 *
 * Module-owned palette in the same spirit as `comparisonTheme.ts` and
 * `triggersTheme.ts`: the screen still sits on the app's shared navy
 * (`dsColors.bgBase`) and reuses `dsSpacing`, but everything *inside*
 * the Profile surface is driven by a single soft-neon-blue accent.
 *
 * Why its own accent instead of `dsColors.accentBlue` (#4DABFF): the
 * Core hero has to sit above five addiction hues at once without
 * belonging to any of them. #5cc9f5 is cooler and lighter, so
 * filaments in nicotine grey, caffeine brown or alcohol gold all read
 * as *feeding* the core rather than competing with it.
 *
 * The addiction hues themselves are NOT redefined here — they come
 * from `constants/addictions.ts` at render time, one source of truth.
 */

import { hexAlpha } from '@/constants/designSystem';

export { hexAlpha };

/** App-wide Profile accent. Soft neon blue. */
export const coreNeon = '#5cc9f5';

/** `coreNeon` at an alpha, without repeating the hex at 40 call sites. */
export function neon(alpha: number): string {
  return hexAlpha(coreNeon, alpha);
}

/**
 * Text ramp, brightest → dimmest. Deliberately six steps: the design
 * leans on hierarchy-by-value rather than hierarchy-by-size in the
 * settings rows and the FEEDING THE CORE list.
 */
export const coreText = {
  /** Rank name, hero numbers. */
  title: '#f4f9ff',
  /** Row names, dialog title. */
  strong: '#eaf3ff',
  /** Body copy. */
  body: '#c9d6e8',
  /** Handles, sub-lines, units. */
  secondary: '#7f96b8',
  /** Metric captions. */
  tertiary: '#6b7f9e',
  /** ALL-CAPS section labels. */
  sectionLabel: '#4f6285',
} as const;

/** Hairline between rows / panels. */
export const coreDivider = 'rgba(255,255,255,0.055)';
/** Panel + settings-group border. */
export const coreBorder = 'rgba(255,255,255,0.07)';

/** Destructive action pair (delete account row + dialog CTA). */
export const coreDanger = {
  text: '#e07b78',
  icon: '#e05b57',
  ctaFrom: '#e05b57',
  ctaTo: '#c23d39',
  border: 'rgba(224,91,87,0.34)',
} as const;

/**
 * Panel surfaces. RN can't do `linear-gradient()` in a style object,
 * so each panel is rendered as a flat `top` fill with the `bottom`
 * stop available for callers that mount an SVG/expo LinearGradient.
 */
export const coreSurface = {
  panelTop: 'rgba(19,29,50,0.85)',
  panelBottom: 'rgba(9,14,28,0.85)',
  groupTop: 'rgba(17,26,44,0.8)',
  groupBottom: 'rgba(9,14,28,0.8)',
} as const;

export const coreRadius = {
  screen: 30,
  panel: 22,
  group: 18,
  iconSquare: 11,
  bar: 3,
} as const;

/**
 * Motion. Every loop here is disabled under reduced motion and every
 * entrance snaps to its final frame — see `useReducedMotion()`.
 */
export const CORE_ANIM = {
  /** One rank-ring segment drawing itself in. */
  segDrawMs: 500,
  /** Delay between successive ring segments. */
  segStaggerMs: 70,
  /** Filament line draw-on. */
  lineDrawMs: 600,
  /** Filaments start after the ring has established itself. */
  lineDelayMs: 600,
  /** Delay between successive filaments. */
  lineStaggerMs: 90,
  /** Core breathe cycle (scale 1 ↔ 1.07). */
  breatheMs: 5500,
  /** One full orbit of the spark around the core. */
  orbitMs: 16000,
  /** Ambient halo pulse behind the hero. */
  haloMs: 9000,
  /** Progress / contribution bar fill. */
  barFillMs: 900,
  /** Bar fill waits for the numbers to land. */
  barDelayMs: 700,
  /** Stat count-up roll. */
  countUpMs: 850,
  /** Delay between successive contribution bars. */
  rowStaggerMs: 70,
} as const;
