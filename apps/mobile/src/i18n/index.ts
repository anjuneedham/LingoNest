import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { brandInterpolation } from '@lingonest/core';
import en from '../../locales/en.json';

/**
 * Interface localisation.
 *
 * Two rules the rest of the app depends on:
 *
 * 1. No component contains a user-visible string. Everything goes through `t`,
 *    which is what makes translating the interface a content task rather than
 *    a code task (brief §66).
 * 2. The product name is interpolated, never written. `{{brandName}}` resolves
 *    from the brand config, so renaming the product does not touch a single
 *    locale value.
 */

const SUPPORTED = ['en', 'es', 'fr', 'pt', 'de', 'ja', 'ko', 'zh'] as const;
export type UiLocale = (typeof SUPPORTED)[number];

function deviceLocale(): UiLocale {
  const preferred = getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED as readonly string[]).includes(preferred) ? (preferred as UiLocale) : 'en';
}

export function initI18n(locale?: UiLocale): typeof i18next {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      // English ships complete; the other locales are added as translation
      // lands, and fall back to English key by key rather than showing a blank.
      resources: { en: { translation: en } },
      lng: locale ?? deviceLocale(),
      fallbackLng: 'en',
      compatibilityJSON: 'v4',
      interpolation: {
        escapeValue: false,
        defaultVariables: brandInterpolation(),
      },
      returnNull: false,
    });
  }
  return i18next;
}

export function changeLocale(locale: UiLocale): void {
  void i18next.changeLanguage(locale);
}

export const SUPPORTED_LOCALES = SUPPORTED;
export { i18next };
