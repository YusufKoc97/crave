/**
 * Info-tab local design constants for the AddictionCard.
 *
 * Kept LOCAL (not in constants/designSystem.ts) because the design
 * spec for these cards diverges from the M0 palette in a few
 * places — darker card gradients, radial page background, dashed
 * empty-state — and the rest of the app shouldn't inherit those.
 * Scope guard: change these numbers and only the Info tab moves.
 *
 * The addiction accent ("hue") is NOT baked in here. It's read
 * from `addictionCatalog.color` at render time and derived via
 * hexAlpha for every accent-tinted surface (ring, icon bg, bar
 * fill, "+ Track" pill). One color source, no map divergence.
 */

/** hex → rgba() helper. Duplicated from designSystem.ts on
 *  purpose — this file has zero cross-imports so it can be moved
 *  or deleted without touching the rest of the app. */
export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Card surfaces ───

/** Base card gradient stops (used with LinearGradient / radial fake). */
export const CARD_BG_TRACKED_TOP = '#141d2e';
export const CARD_BG_TRACKED_BOT = '#0a1120';
export const CARD_BG_UNTRACKED_TOP = '#10192b';
export const CARD_BG_UNTRACKED_BOT = '#0b1220';

/** Icon inner circle gradient stops. */
export const ICON_BG_TOP = '#182236';
export const ICON_BG_BOT = '#0c1322';

/** Page background — used by the Info screen root. Three-stop
 *  radial approximated via View + linearGradient stack for RN. */
export const PAGE_BG_INNER = '#101a30';
export const PAGE_BG_MID = '#0a1120';
export const PAGE_BG_OUTER = '#070b16';

// ─── Text ───

export const TEXT_TITLE = '#f4f7fc'; // Screen title "Addictions"
export const TEXT_SUBTITLE = '#5a6d8c'; // "Tap a card to start or stop tracking."
export const TEXT_NAME_TRACKED = '#f8f4ef';
export const TEXT_NAME_UNTRACKED = '#dbe4f0';
export const TEXT_STATUS_MUTED = '#5a6d8c';
export const TEXT_STATUS_UNTRACKED = '#59708f';
export const TEXT_SECTION_LABEL = '#5a7099';
export const TEXT_CHIP = '#8aa0c4';
export const TEXT_BAR_LABEL = 'rgba(255,255,255,0.4)';

// ─── Section header ───

export const CHIP_BG = 'rgba(255,255,255,0.05)';
export const CHIP_BORDER = 'rgba(255,255,255,0.08)';
export const HAIRLINE_START = 'rgba(255,255,255,0.12)';

// ─── Card structural ───

export const CARD_RADIUS = 22;
export const CARD_GAP = 13;
export const CARD_PAD_H = 15;
export const CARD_PAD_V = 20;
export const ICON_SIZE = 56;
export const RING_BOX = 74;
export const RING_STROKE = 5;
export const RING_RADIUS = 33;
/** Circumference = 2 * π * 33 → 207.32 (locked, matches design). */
export const RING_CIRCUMFERENCE = 207.32;

/** Card border + shadow tokens (hue applied at render). */
export const UNTRACKED_BORDER = 'rgba(255,255,255,0.07)';
export const INSET_HIGHLIGHT_TRACKED = 'rgba(255,255,255,0.07)';
export const INSET_HIGHLIGHT_UNTRACKED = 'rgba(255,255,255,0.04)';

// ─── Progress bar ───

export const BAR_TRACK_BG = 'rgba(255,255,255,0.07)';
export const BAR_HEIGHT = 6;
export const BAR_RADIUS = 3;

// ─── Ring track fallback (used on untracked variant) ───

export const RING_TRACK_UNTRACKED = 'rgba(255,255,255,0.06)';

// ─── Font stack (web-safe fallback — karar #4) ───

export const FONT_STACK = 'Manrope, SF Pro Display, system-ui, sans-serif';
