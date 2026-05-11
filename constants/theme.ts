export const colors = {
  bg: '#020810',
  bgDeep: '#050A14',
  bgCard: '#0D1626',
  bgCardAlt: '#0A1628',
  bgPill: '#0D1E35',
  bgPillSubtle: '#080F1C',

  ambientOuter: '#060F1E',
  ambientMid: '#091525',
  ambientInner: '#0D1E35',

  blue: '#3B82F6',
  blueSoft: '#7BA8C8',
  purple: '#7C3AED',
  green: '#10B981',
  red: '#EF4444',

  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#6B8BA4',
  textDim: '#3D5470',

  border: '#1E2D45',
  borderSoft: '#1A2840',
  borderStrong: '#3B5070',
  borderTab: '#1E3050',

  orbInner: '#08111E',
  orbBorder: '#3B5070',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 40,
  full: 9999,
} as const;

/**
 * Surface tokens give every card the same "light-from-above" feel
 * without breaking the dark/flat aesthetic. Two layers:
 *   - cardSurface  — base background + subtle border with a slight
 *                    blue tint (warmer than pure gray on the dark bg).
 *   - cardElevated — adds a soft outer glow + larger radius for the
 *                    primary stat / share / hero cards.
 *
 * The "inner highlight" (top 1px alpha-white line) is rendered as a
 * 1px absolutely-positioned child View by <Card />. It's intentionally
 * not on the borderTopColor because RN doesn't let you mix
 * per-side colors on a single border definition cleanly.
 */
export const surfaces = {
  card: {
    backgroundColor: '#0A1628',
    borderColor: '#1E2D4D',
    borderWidth: 1,
  },
  cardSoft: {
    backgroundColor: '#0D1E35',
    borderColor: '#1E3050',
    borderWidth: 1,
  },
  cardElevated: {
    backgroundColor: '#0A1628',
    borderColor: '#1E2D4D',
    borderWidth: 1,
    // Native uses shadow*; web reads boxShadow.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  /** Top inner highlight line — a 1px alpha-white View pinned to the
   *  top edge of a card, inside its border radius. */
  innerHighlight: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
} as const;

export const font = {
  size: {
    xs: 9,
    sm: 11,
    md: 13,
    base: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    timer: 56,
  },
  weight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  letterSpacing: {
    tight: 1,
    normal: 2,
    wide: 4,
    wider: 8,
  },
} as const;
