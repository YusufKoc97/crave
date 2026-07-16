/**
 * Design System v1 — the polish-phase palette + tokens shared by the
 * Info, Profile, and Active-Session redesigns.
 *
 * This lives ALONGSIDE `constants/theme.ts` — we didn't retrofit the
 * old palette because the home/onboarding/auth screens still consume
 * those tokens and a global rewrite would blow up scope. New code
 * should import from here; legacy code stays on `theme.ts` until it
 * gets picked up in a later polish pass.
 *
 * Everything below matches the numbers in the Design Polish brief
 * verbatim. When in doubt, refer to the brief — this file is the
 * single source of truth for those numbers on the client side.
 */

// ─────────────────────────── Palette ───────────────────────────

/** Base + surface colours from the design brief. */
export const dsColors = {
  bgBase: '#0A1428', // deep navy, near-black
  cardSurface: '#131F3A', // one shade lighter — resting card bg
  cardSurfaceElevated: '#1A2748', // pressed / hovered state
  borderSubtle: '#1F2E52',
  borderAccent: '#2B3E6E',

  textPrimary: '#FFFFFF',
  textSecondary: '#8FA5CC',
  textTertiary: '#5A6E92',

  accentBlue: '#4DABFF', // primary neon accent
  accentBlueDim: '#2A6BB8',
  successGlow: '#4DFFB4',
  dangerGlow: '#FF6B6B',
} as const;

// ─────────────────────── Spacing (4pt grid) ─────────────────────

export const dsSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  x3l: 32,
  x4l: 40,
  x5l: 48,
} as const;

// ─────────────────────── Border radius ──────────────────────────

export const dsRadius = {
  card: 20,
  button: 14,
  pill: 9999,
  modalTop: 24,
} as const;

// ─────────────────────── Typography ────────────────────────────

/** System font, weights only. Brief locks 400/600/700. */
export const dsFont = {
  weight: {
    regular: '400' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  size: {
    // Body scale
    tiny: 11,
    label: 13,
    body: 15,
    bodyLg: 16,
    heading: 17,
    // Display scale
    displaySm: 20,
    displayMd: 28,
    displayLg: 32,
    displayXl: 34,
    displayXxl: 48,
    // Timer
    timer: 72,
  },
  letterSpacing: {
    tight: 0.2,
    normal: 0.4,
    caps: 2,
  },
} as const;

// ─────────────────── Common composite tokens ───────────────────

/** Composite style objects for the two card sizes on the Info tab. */
export const dsCardStyles = {
  tracking: {
    height: 88,
    padding: dsSpacing.xl,
    borderRadius: dsRadius.card,
    backgroundColor: dsColors.cardSurface,
    borderColor: dsColors.borderSubtle,
    borderWidth: 1,
  },
  untracked: {
    height: 56,
    paddingHorizontal: dsSpacing.lg,
    paddingVertical: dsSpacing.md,
    borderRadius: dsRadius.card,
    // 60% opacity via alpha channel — brief spec.
    backgroundColor: 'rgba(19, 31, 58, 0.6)',
    borderColor: dsColors.borderSubtle,
    borderWidth: 1,
  },
} as const;

/**
 * Section header — used above TRACKING / ALL ADDICTIONS on the Info
 * tab, and above STATISTICS / YOUR ADDICTIONS / SETTINGS on Profile.
 */
export const dsSectionHeaderStyle = {
  fontSize: dsFont.size.tiny,
  fontWeight: dsFont.weight.semibold,
  letterSpacing: dsFont.letterSpacing.caps,
  color: dsColors.textSecondary,
  textTransform: 'uppercase' as const,
  marginTop: dsSpacing.x3l,
  marginBottom: dsSpacing.lg,
};

/** hex → rgba(). Used for addiction-color tints on cards. */
export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
