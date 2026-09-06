import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkTheme,
  lightTheme,
  radius,
  spacing,
  textScales,
  typography,
  type TextScale,
  type Theme,
  type TypographyVariant,
} from './tokens';
import { useSettingsStore } from '@/store/settings';

interface ThemeContextValue {
  readonly theme: Theme;
  readonly isDark: boolean;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  /** Type style with the learner's text-size preference already applied. */
  type: (variant: TypographyVariant) => {
    fontSize: number;
    lineHeight: number;
    fontWeight: '400' | '500' | '600' | '700';
  };
  readonly textScale: TextScale;
  readonly highContrast: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useSettingsStore((s) => s.appearance);
  const textScale = useSettingsStore((s) => s.textScale);
  const highContrast = useSettingsStore((s) => s.highContrast);

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const value = useMemo<ThemeContextValue>(() => {
    const base = isDark ? darkTheme : lightTheme;
    // High contrast strengthens borders and text rather than changing hues, so
    // the interface stays recognisable.
    const theme: Theme = highContrast
      ? {
          ...base,
          text: isDark ? '#FFFFFF' : '#000000',
          textMuted: isDark ? '#E2E8F0' : '#1E293B',
          border: isDark ? '#94A3B8' : '#334155',
          borderStrong: isDark ? '#CBD5E1' : '#0F172A',
        }
      : base;

    const scale = textScales[textScale];

    return {
      theme,
      isDark,
      spacing,
      radius,
      textScale,
      highContrast,
      type: (variant) => {
        const style = typography[variant];
        return {
          fontSize: Math.round(style.fontSize * scale),
          lineHeight: Math.round(style.lineHeight * scale),
          fontWeight: style.fontWeight as '400' | '500' | '600' | '700',
        };
      },
    };
  }, [isDark, textScale, highContrast]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
