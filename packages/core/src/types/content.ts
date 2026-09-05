import type { Cefr } from '../cefr/levels';
import type { Skill } from '../skills/skills';
import type { Activity } from '../activities/types';

/** CMS workflow state shared by every content entity (brief §46, §47). */
export const CONTENT_STATUSES = ['draft', 'in_review', 'approved', 'published', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Writing systems that need a dedicated Pre-A1 module. */
export type WritingSystem = 'latin' | 'cyrillic' | 'greek' | 'arabic' | 'hebrew' | 'devanagari' | 'kana_kanji' | 'hangul' | 'hanzi' | 'thai';

export interface Language {
  readonly code: string; // ISO 639-1 where available
  readonly name: string; // English name
  readonly nativeName: string;
  readonly writingSystem: WritingSystem;
  readonly rtl: boolean;
  /** Pre-A1 must teach the script before anything else. */
  readonly requiresScriptModule: boolean;
  /** Words are not space-separated (affects tokenised activities). */
  readonly spaceSeparated: boolean;
  readonly variants: readonly LanguageVariant[];
  readonly defaultVariantCode: string;
  /** Plus bands enabled for this language. */
  readonly plusLevels: readonly Cefr[];
  readonly status: ContentStatus;
}

export interface LanguageVariant {
  readonly code: string; // es-MX, pt-BR …
  readonly label: string;
  readonly region: string;
  readonly isDefault: boolean;
}

export interface Course {
  readonly id: string;
  readonly languageCode: string;
  readonly cefr: Cefr;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly ordinal: number;
  readonly status: ContentStatus;
  readonly units: readonly Unit[];
}

export interface Unit {
  readonly id: string;
  readonly courseId: string;
  readonly ordinal: number;
  readonly title: string;
  /** The can-do statement this unit delivers. */
  readonly objective: string;
  readonly theme: string;
  readonly cefr: Cefr;
  readonly status: ContentStatus;
  /** The concrete real-world task the unit builds towards (brief §78). */
  readonly realWorldTask?: string;
  readonly lessons: readonly Lesson[];
}

export interface Lesson {
  readonly id: string;
  readonly unitId: string;
  readonly ordinal: number;
  readonly slug: string;
  readonly title: string;
  readonly objective: string;
  readonly canDo: string;
  readonly cefr: Cefr;
  readonly skills: readonly Skill[];
  readonly estimatedMinutes: number;
  readonly status: ContentStatus;
  readonly isReview: boolean;
  readonly isCheckpoint: boolean;
  readonly vocabularyIds: readonly string[];
  readonly grammarTopicIds: readonly string[];
  readonly cultureNoteIds: readonly string[];
  readonly activities: readonly Activity[];
  /** Set when the draft came from the AI content assistant (brief §47). */
  readonly generatedBy?: 'human' | 'ai';
}

export interface VocabularyItem {
  readonly id: string;
  readonly languageCode: string;
  readonly term: string;
  readonly translation: string;
  readonly partOfSpeech?: string;
  readonly gender?: string;
  readonly pronunciation?: string;
  readonly exampleSentence?: string;
  readonly exampleTranslation?: string;
  readonly audioAssetKey?: string;
  readonly imageAssetKey?: string;
  readonly cefr: Cefr;
  readonly difficulty: number;
  readonly categories: readonly string[];
  /** Variant-specific alternatives, e.g. { 'es-MX': 'carro' }. */
  readonly variantOverrides?: Readonly<Record<string, string>>;
  readonly status: ContentStatus;
}

export const VOCABULARY_CATEGORIES = [
  'greetings',
  'family',
  'food',
  'drinks',
  'travel',
  'business',
  'school',
  'home',
  'health',
  'technology',
  'relationships',
  'sports',
  'entertainment',
  'nature',
  'shopping',
  'transportation',
  'emergency',
  'culture',
  'numbers',
  'time',
  'weather',
  'clothing',
  'work',
  'directions',
  'hobbies',
  'body',
  'colors',
  'animals',
] as const;

export type VocabularyCategory = (typeof VOCABULARY_CATEGORIES)[number];

export interface GrammarTopic {
  readonly id: string;
  readonly languageCode: string;
  readonly title: string;
  readonly cefr: Cefr;
  readonly summary: string;
  /** Explanation shown before the interactive practice — never the whole lesson. */
  readonly explanation: string;
  readonly examples: readonly { target: string; native: string }[];
  readonly commonMistakes: readonly { wrong: string; right: string; why: string }[];
  readonly status: ContentStatus;
}

export interface CultureNote {
  readonly id: string;
  readonly languageCode: string;
  /** Variants this note applies to; culture is regional, never universal (brief §27). */
  readonly variantCodes: readonly string[];
  readonly title: string;
  readonly body: string;
  readonly cefr: Cefr;
  readonly topic: string;
  readonly status: ContentStatus;
}

export interface ConversationScenario {
  readonly key: string;
  readonly languageCode: string;
  readonly title: string;
  readonly setting: string;
  /** Character the AI plays (brief §79). */
  readonly partnerRole: string;
  readonly learnerRole: string;
  readonly cefr: Cefr;
  readonly goals: readonly string[];
  /** Vocabulary the learner is expected to use. */
  readonly vocabularyIds: readonly string[];
  readonly openingLine: string;
  readonly complications?: readonly string[];
  readonly status: ContentStatus;
}

export interface MediaAsset {
  readonly key: string;
  readonly kind: 'audio' | 'image' | 'video';
  readonly url: string;
  readonly durationMs?: number;
  /** Licensing metadata is required before an asset may back published content. */
  readonly source: string;
  readonly licence: string;
  readonly attribution?: string;
  readonly voice?: string;
  readonly speed?: 'slow' | 'normal' | 'natural';
  readonly variantCode?: string;
}
