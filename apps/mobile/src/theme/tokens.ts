/**
 * Design tokens.
 *
 * Colour is never the only carrier of meaning (brief §62): every state that
 * uses colour also has an icon, a label or a shape, so the app works for a
 * colour-blind learner and in high contrast.
 */

export const palette = {
  // Brand
  ink900: '#0F172A',
  ink800: '#1E293B',
  ink700: '#334155',
  ink500: '#64748B',
  ink400: '#94A3B8',
  ink300: '#CBD5E1',
  ink200: '#E2E8F0',
  ink100: '#F1F5F9',
  ink50: '#F8FAFC',
  white: '#FFFFFF',

  // Primary — used for progress, primary actions and the current level
  brand700: '#1D4ED8',
  brand600: '#2563EB',
  brand500: '#3B82F6',
  brand100: '#DBEAFE',
  brand50: '#EFF6FF',

  // Correct / incorrect. Always paired with an icon.
  success700: '#15803D',
  success600: '#16A34A',
  success100: '#DCFCE7',
  danger700: '#B91C1C',
  danger600: '#DC2626',
  danger100: '#FEE2E2',
  warning700: '#B45309',
  warning600: '#D97706',
  warning100: '#FEF3C7',

  // Streaks and rewards
  flame600: '#EA580C',
  flame100: '#FFEDD5',
} as const;

export interface Theme {
  readonly background: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textInverse: string;
  readonly primary: string;
  readonly primaryMuted: string;
  readonly primaryText: string;
  readonly success: string;
  readonly successMuted: string;
  readonly danger: string;
  readonly dangerMuted: string;
  readonly warning: string;
  readonly warningMuted: string;
  readonly streak: string;
  readonly streakMuted: string;
  readonly overlay: string;
}

export const lightTheme: Theme = {
  background: palette.ink50,
  surface: palette.white,
  surfaceMuted: palette.ink100,
  border: palette.ink200,
  borderStrong: palette.ink300,
  text: palette.ink900,
  textMuted: palette.ink500,
  textInverse: palette.white,
  primary: palette.brand600,
  primaryMuted: palette.brand100,
  primaryText: palette.white,
  success: palette.success600,
  successMuted: palette.success100,
  danger: palette.danger600,
  dangerMuted: palette.danger100,
  warning: palette.warning600,
  warningMuted: palette.warning100,
  streak: palette.flame600,
  streakMuted: palette.flame100,
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export const darkTheme: Theme = {
  background: palette.ink900,
  surface: palette.ink800,
  surfaceMuted: palette.ink700,
  border: palette.ink700,
  borderStrong: palette.ink500,
  text: palette.ink50,
  textMuted: palette.ink400,
  textInverse: palette.ink900,
  primary: palette.brand500,
  primaryMuted: '#1E3A8A',
  primaryText: palette.white,
  success: '#4ADE80',
  successMuted: '#14532D',
  danger: '#F87171',
  dangerMuted: '#7F1D1D',
  warning: '#FBBF24',
  warningMuted: '#78350F',
  streak: '#FB923C',
  streakMuted: '#7C2D12',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** 4-point spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Type scale. Sizes are multiplied by the learner's text-size preference, so
 * "large text" is a real setting rather than a system-only accommodation.
 */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  subheading: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  /** Target-language text is set larger: it is what the learner is studying. */
  target: { fontSize: 22, lineHeight: 32, fontWeight: '600' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const textScales = { small: 0.9, default: 1, large: 1.2, xlarge: 1.45 } as const;
export type TextScale = keyof typeof textScales;

/** Minimum touch target, per platform accessibility guidance. */
export const MIN_TOUCH_TARGET = 44;

export const elevation = {
  none: {},
  card: {
    shadowColor: palette.ink900,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: palette.ink900,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;
