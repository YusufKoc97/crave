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
