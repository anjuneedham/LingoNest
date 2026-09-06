import type { Language } from '@lingonest/core';

/**
 * Language definitions.
 *
 * Adding a language is a data change: the renderer, the SRS, the grading
 * pipeline and the AI prompts are all language-agnostic. Behaviour that really
 * does differ by language — script direction, whether a script module is
 * needed, word segmentation — is declared here and read by generic code.
 */

export const LAUNCH_LANGUAGES: readonly Language[] = [
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    writingSystem: 'latin',
    rtl: false,
    requiresScriptModule: false,
    spaceSeparated: true,
    defaultVariantCode: 'es-419',
    plusLevels: ['A2_PLUS', 'B1_PLUS'],
    status: 'published',
    variants: [
      { code: 'es-ES', label: 'Spain', region: 'Europe', isDefault: false },
      { code: 'es-MX', label: 'Mexico', region: 'North America', isDefault: false },
      { code: 'es-419', label: 'Latin America (neutral)', region: 'Americas', isDefault: true },
      { code: 'es-AR', label: 'Argentina & Uruguay', region: 'South America', isDefault: false },
      { code: 'es-CO', label: 'Colombia', region: 'South America', isDefault: false },
      { code: 'es-CL', label: 'Chile', region: 'South America', isDefault: false },
      { code: 'es-CA', label: 'Caribbean', region: 'Caribbean', isDefault: false },
    ],
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    writingSystem: 'latin',
    rtl: false,
    requiresScriptModule: false,
    spaceSeparated: true,
    defaultVariantCode: 'en-US',
    plusLevels: ['A2_PLUS', 'B1_PLUS'],
    status: 'published',
    variants: [
      { code: 'en-US', label: 'United States', region: 'North America', isDefault: true },
      { code: 'en-GB', label: 'United Kingdom', region: 'Europe', isDefault: false },
      { code: 'en-CA', label: 'Canada', region: 'North America', isDefault: false },
      { code: 'en-AU', label: 'Australia', region: 'Oceania', isDefault: false },
      { code: 'en-IN', label: 'India', region: 'Asia', isDefault: false },
    ],
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    writingSystem: 'latin',
    rtl: false,
    requiresScriptModule: false,
    spaceSeparated: true,
    defaultVariantCode: 'fr-FR',
    plusLevels: ['A2_PLUS'],
    status: 'published',
    variants: [
      { code: 'fr-FR', label: 'France', region: 'Europe', isDefault: true },
      { code: 'fr-CA', label: 'Canada (Québec)', region: 'North America', isDefault: false },
      { code: 'fr-BE', label: 'Belgium', region: 'Europe', isDefault: false },
      { code: 'fr-CH', label: 'Switzerland', region: 'Europe', isDefault: false },
      { code: 'fr-AF', label: 'West & Central Africa', region: 'Africa', isDefault: false },
    ],
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    writingSystem: 'kana_kanji',
    rtl: false,
    // Pre-A1 must teach hiragana and katakana before anything else.
    requiresScriptModule: true,
    spaceSeparated: false,
    defaultVariantCode: 'ja-JP',
    plusLevels: ['A2_PLUS'],
    status: 'published',
    variants: [
      { code: 'ja-JP', label: 'Standard (Tokyo)', region: 'Japan', isDefault: true },
      { code: 'ja-KS', label: 'Kansai', region: 'Japan', isDefault: false },
    ],
  },
];

/**
 * Languages the architecture supports and the roadmap expands into. They are
 * listed here so the language picker, the teacher application form and the
 * marketplace filters are all driven by one list — adding curriculum for one of
 * these needs no application change.
 */
export const PLANNED_LANGUAGES: readonly Omit<Language, 'variants'>[] = [
  { code: 'de', name: 'German', nativeName: 'Deutsch', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'de-DE', plusLevels: [], status: 'draft' },
  { code: 'zh', name: 'Mandarin Chinese', nativeName: '中文', writingSystem: 'hanzi', rtl: false, requiresScriptModule: true, spaceSeparated: false, defaultVariantCode: 'zh-CN', plusLevels: [], status: 'draft' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'pt-BR', plusLevels: [], status: 'draft' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'it-IT', plusLevels: [], status: 'draft' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', writingSystem: 'hangul', rtl: false, requiresScriptModule: true, spaceSeparated: true, defaultVariantCode: 'ko-KR', plusLevels: [], status: 'draft' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', writingSystem: 'arabic', rtl: true, requiresScriptModule: true, spaceSeparated: true, defaultVariantCode: 'ar-MSA', plusLevels: [], status: 'draft' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', writingSystem: 'devanagari', rtl: false, requiresScriptModule: true, spaceSeparated: true, defaultVariantCode: 'hi-IN', plusLevels: [], status: 'draft' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', writingSystem: 'cyrillic', rtl: false, requiresScriptModule: true, spaceSeparated: true, defaultVariantCode: 'ru-RU', plusLevels: [], status: 'draft' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'nl-NL', plusLevels: [], status: 'draft' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'tr-TR', plusLevels: [], status: 'draft' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'pl-PL', plusLevels: [], status: 'draft' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'sv-SE', plusLevels: [], status: 'draft' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'nb-NO', plusLevels: [], status: 'draft' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'da-DK', plusLevels: [], status: 'draft' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', writingSystem: 'greek', rtl: false, requiresScriptModule: true, spaceSeparated: true, defaultVariantCode: 'el-GR', plusLevels: [], status: 'draft' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', writingSystem: 'hebrew', rtl: true, requiresScriptModule: true, spaceSeparated: true, defaultVariantCode: 'he-IL', plusLevels: [], status: 'draft' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'vi-VN', plusLevels: [], status: 'draft' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', writingSystem: 'thai', rtl: false, requiresScriptModule: true, spaceSeparated: false, defaultVariantCode: 'th-TH', plusLevels: [], status: 'draft' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'id-ID', plusLevels: [], status: 'draft' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'sw-KE', plusLevels: [], status: 'draft' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog', writingSystem: 'latin', rtl: false, requiresScriptModule: false, spaceSeparated: true, defaultVariantCode: 'tl-PH', plusLevels: [], status: 'draft' },
];

export function languageByCode(code: string): Language | undefined {
  return LAUNCH_LANGUAGES.find((l) => l.code === code);
}
