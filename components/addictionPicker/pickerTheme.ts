import {
  Beer,
  Cigarette,
  Cloud,
  Coffee,
  Dice5,
  EyeOff,
  Gamepad2,
  Sandwich,
  ShoppingBag,
  Smartphone,
  type LucideIcon,
} from 'lucide-react-native';
import { hexAlpha } from '@/constants/designSystem';

/**
 * Tokens for the "Socket Loadout" add-addiction sheet.
 *
 * Numbers come from the design handoff verbatim. Two deliberate
 * deviations from the handoff, both because it was written without
 * access to the app's data model:
 *
 * 1. **Hues.** The handoff lists its own hex values and claims they
 *    match the app. They don't — they're desaturated variants. The
 *    intent ("same colour the rest of the app uses for this
 *    addiction") is what matters, so the sheet reads `color` straight
 *    off `ADDICTION_CATALOG`. One source of truth; the token in the
 *    sheet is the same colour as the orb on the home screen.
 *
 * 2. **Slot count.** The handoff hardcodes four sockets. The real
 *    ceiling is `FREE_ACTIVE_LIMIT` / `PREMIUM_ACTIVE_LIMIT` (1 / 5),
 *    surfaced by `useAddictions().limit`. Every layout number below is
 *    therefore a function of the live limit, not a constant — see
 *    `socketSizeFor()`.
 */

/** Identity / limit / premium colour. Never used for an addiction. */
export const GOLD = '#d9b45a';

export function goldA(alpha: number): string {
  return hexAlpha(GOLD, alpha);
}

export const pickerColors = {
  /** Page base. A GlowDisc lifts the top centre toward #0f1830. */
  bgBase: '#080c18',
  bgLift: '#0f1830',

  headerBg: 'rgba(16, 24, 44, 0.9)',
  hairline: 'rgba(255, 255, 255, 0.07)',

  /** Socket / token interior falloff target. */
  socketDepth: '#0e1424',
  tokenDepth: '#0c1222',

  title: '#f4f7fc',
  subtitle: '#7f8db0',
  sectionLabel: '#5a7099',
  counter: '#8aa0c4',
  tokenName: '#9fb0cc',
  tokenNameLocked: '#7f8da8',
  emptyLabel: '#41527a',
  emptyGlyph: '#3d4d70',
  closeGlyph: '#c7d2e2',
  lockGlyph: '#8595ad',
  lockBadgeBg: '#0d1424',
  badgeGlyph: '#0d1220',
  danger: '#ff8080',
} as const;

/** Radii from the brief. */
export const pickerRadius = {
  panel: 24,
  panelHalo: 26,
  socket: 20,
  close: 13,
  pill: 20,
} as const;

/** Animation durations (ms) — brief numbers, converted from seconds. */
export const pickerTiming = {
  chipIn: 400,
  chipInStagger: 40,
  socketStagger: 50,
  hintPulse: 2600,
  sheen: 7000,
  sheenDelay: 1200,
  shake: 500,
  glowPulse: 1000,
  ringOut: 600,
  press: 160,
} as const;

/**
 * "Neon materialize" — what happens to the socket that was just
 * equipped. Replaces the old `socketPop` spring, which overshot to
 * 1.16 and read as the tile physically hopping into the panel.
 *
 * Three layers, all pure `withTiming` with `Easing.out`. **No spring
 * anywhere**: the tile must never pass 1.0, or the hop is back.
 *
 * 1. `tile`     — the socket itself resolves in place (opacity 0→1,
 *                 scale .94→1).
 * 2. `edgeIn/Out` — a neon frame `edgeInset` outside the tile flares
 *                 up and dies away. It is not a persistent border.
 * 3. `halo`     — a radial wash `haloInset` outside, expanding to
 *                 1.5× as it fades: the light spilling outward.
 *
 * The blur half of the tile step (6px→0) is web-only territory and is
 * dropped on native, which the brief allows — opacity plus scale
 * carries the same "resolving into focus" read without pulling in a
 * blur backend.
 */
export const pickerMaterialize = {
  tile: 550,
  edgeIn: 230,
  edgeOut: 550,
  halo: 850,
  /** How far outside the socket the neon frame sits, in pt. */
  edgeInset: 3,
  /** How far outside the socket the halo starts, in pt. */
  haloInset: 8,
} as const;

/** Layout constants shared by the screen and the panel. */
export const pickerLayout = {
  pagePadding: 20,
  panelPadding: 15,
  socketGap: 10,
  /** Cap so a 1-slot free tier doesn't render one enormous square. */
  socketMax: 78,
  tokenSize: 56,
  poolColumns: 4,
  poolColumnGap: 8,
  poolRowGap: 16,
} as const;

/**
 * Socket edge length for `count` sockets inside `panelInnerWidth`.
 *
 * The handoff's four sockets land at ~72pt on a 390pt screen; the cap
 * keeps that scale when the free tier only grants one slot, instead of
 * letting `flex: 1` blow a single socket up to the full panel width.
 */
export function socketSizeFor(panelInnerWidth: number, count: number): number {
  if (count <= 0) return 0;
  const spread =
    (panelInnerWidth - pickerLayout.socketGap * (count - 1)) / count;
  return Math.max(44, Math.min(pickerLayout.socketMax, spread));
}

/**
 * Catalog id → Lucide glyph. Replaces the iOS-emoji chips, which
 * rendered differently on every platform and carried no line weight.
 * Keys are the app's ids (`junk_food`, `pmo`, `doomscroll`, `gaming`),
 * not the handoff's prototype ids.
 */
export const ADDICTION_ICON: Record<string, LucideIcon> = {
  nicotine: Cigarette,
  alcohol: Beer,
  caffeine: Coffee,
  vape: Cloud,
  gambling: Dice5,
  junk_food: Sandwich,
  shopping: ShoppingBag,
  pmo: EyeOff,
  doomscroll: Smartphone,
  gaming: Gamepad2,
};
