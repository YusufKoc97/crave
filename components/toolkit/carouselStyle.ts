/**
 * Toolkit carousel — local design tokens.
 *
 * Kept LOCAL (not in constants/designSystem.ts) because the
 * carousel's palette diverges from the M0 dark-navy tokens
 * (deeper black base, purple/indigo atmosphere, glass panels
 * with higher-alpha whites). Scope guard: change these numbers
 * and only the Toolkit sub-tab moves.
 */

// ─── Base + atmosphere ───

export const BG_BASE = '#0A0A0F';
export const ORB_PURPLE = '#4A0080';
export const ORB_INDIGO = '#1A0060';

// ─── Glass surfaces ───

export const GLASS_BG = 'rgba(255,255,255,0.08)';
export const GLASS_BG_ACTIVE = 'rgba(255,255,255,0.15)';
export const GLASS_BORDER = 'rgba(255,255,255,0.14)';
export const GLASS_BORDER_ACTIVE = 'rgba(255,255,255,0.22)';
export const GLASS_INSET_HIGHLIGHT = 'rgba(255,255,255,0.08)';

// ─── Card ───

export const CARD_W = 300;
export const CARD_H = 452;
export const CARD_GAP = 14;
export const CARD_RADIUS = 30;
export const CARD_BG_TOP = '#0d1020';
export const CARD_BG_BOT = '#090b14';

// ─── Glass info panel (inside card, bottom) ───

export const PANEL_RADIUS = 22;
export const PANEL_INSET = 12;

// ─── Text ───

export const TEXT_TITLE = '#ffffff';
export const TEXT_SUBTITLE = 'rgba(255,255,255,0.62)';
export const TEXT_MUTED = 'rgba(255,255,255,0.55)';
export const TEXT_HINT = 'rgba(255,255,255,0.6)';

// ─── Dots ───

export const DOT_INACTIVE = 'rgba(255,255,255,0.25)';
export const DOT_INACTIVE_SIZE = 7;
export const DOT_ACTIVE_LENGTH = 22;
export const DOT_HEIGHT_ACTIVE = 7;

// ─── Play button ───

export const PLAY_SIZE = 56;
export const PLAY_BG = '#ffffff';
export const PLAY_ICON_COLOR = '#0d1020';

// ─── Font stack (web-safe fallback) ───

export const FONT_STACK = 'Manrope, SF Pro Display, system-ui, sans-serif';

// ─── Per-technique cinematic hues ───

/** Two-stop radial glow colors per technique. Applied as the
 *  full-bleed scene background before the technique-specific
 *  preview animation. These are DISTINCT from the addiction
 *  accent — the accent still owns UI (play, dot, progress);
 *  these own atmosphere. */
export const SCENE_HUES: Record<
  string,
  { primary: string; secondary: string }
> = {
  breathing_478: { primary: '#7B2FBE', secondary: '#D858A0' },
  urge_surfing: { primary: '#1FA9C4', secondary: '#3E7CE9' },
  grounding_54321: { primary: '#E8A54A', secondary: '#E76A63' },
  body_scan: { primary: '#7B3FE0', secondary: '#4A2FA8' },
};

/** hex → rgba() helper. Duplicated on purpose (no cross-imports). */
export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
