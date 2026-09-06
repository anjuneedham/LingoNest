import type { Cefr, LessonStage, Skill, ActivityType, Hint } from '@lingonest/core';

/**
 * Authoring types.
 *
 * These are deliberately looser than the runtime types in @lingonest/core:
 * an author writes what is interesting (the prompt, the answer, why it is
 * wrong) and the builders in `dsl/builders.ts` fill in ordinals, stages,
 * default skills and point values. `dsl/compile.ts` then produces the strict
 * runtime shape and the validator checks it.
 */

export interface AuthoredActivity {
  readonly type: ActivityType;
  readonly stage?: LessonStage;
  readonly skill?: Skill;
  readonly cefr?: Cefr;
  readonly difficulty?: 1 | 2 | 3 | 4 | 5;
  readonly prompt: unknown;
  readonly correctAnswer?: unknown;
  readonly acceptableAnswers?: readonly unknown[];
  readonly hints?: readonly Hint[];
  readonly explanation?: string;
  readonly media?: readonly { assetKey: string; kind: 'audio' | 'image' | 'video'; speed?: 'slow' | 'normal' | 'natural'; transcript?: string; altText?: string }[];
  readonly rubric?: { goal: string; criteria: readonly string[]; mustInclude?: readonly string[]; minWords?: number };
  readonly points?: number;
  readonly timeLimitSeconds?: number;
  /** Grammar topic keys, vocabulary keys or phonemes this activity trains. */
  readonly tags?: readonly string[];
  readonly variants?: readonly string[];
}

export interface AuthoredLesson {
  readonly slug: string;
  readonly title: string;
  /** What the learner will be able to do, in the author's words. */
  readonly objective: string;
  /** The can-do statement shown to the learner. */
  readonly canDo: string;
  readonly cefr: Cefr;
  readonly minutes: number;
  readonly skills?: readonly Skill[];
  readonly vocabulary?: readonly string[];
  readonly grammar?: readonly string[];
  readonly culture?: readonly string[];
  readonly isReview?: boolean;
  readonly isCheckpoint?: boolean;
  readonly activities: readonly AuthoredActivity[];
}

export interface AuthoredUnit {
  readonly slug: string;
  readonly title: string;
  readonly objective: string;
  readonly theme: string;
  readonly cefr: Cefr;
  /** The concrete thing the learner can do outside the app after this unit. */
  readonly realWorldTask: string;
  readonly lessons: readonly AuthoredLesson[];
}

export interface AuthoredCourse {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly cefr: Cefr;
  readonly units: readonly AuthoredUnit[];
}

export interface AuthoredVocabulary {
  readonly key: string;
  readonly term: string;
  readonly translation: string;
  readonly cefr: Cefr;
  readonly categories: readonly string[];
  readonly partOfSpeech?: string;
  readonly gender?: string;
  readonly pronunciation?: string;
  readonly example?: string;
  readonly exampleTranslation?: string;
  readonly audio?: string;
  readonly image?: string;
  readonly difficulty?: 1 | 2 | 3 | 4 | 5;
  /** Regional alternatives, e.g. { 'es-MX': 'carro' }. */
  readonly variantOverrides?: Readonly<Record<string, string>>;
}

export interface AuthoredGrammar {
  readonly key: string;
  readonly title: string;
  readonly cefr: Cefr;
  readonly summary: string;
  readonly explanation: string;
  readonly examples: readonly { target: string; native: string }[];
  readonly commonMistakes?: readonly { wrong: string; right: string; why: string }[];
}

export interface AuthoredCulture {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly cefr: Cefr;
  readonly topic: string;
  /** Empty means it applies to every variant of the language. */
  readonly variantCodes?: readonly string[];
}

export interface AuthoredScenario {
  readonly key: string;
  readonly title: string;
  readonly setting: string;
  readonly partnerRole: string;
  readonly learnerRole: string;
  readonly cefr: Cefr;
  readonly goals: readonly string[];
  readonly openingLine: string;
  readonly complications?: readonly string[];
  readonly vocabulary?: readonly string[];
}

export interface AuthoredMedia {
  readonly key: string;
  readonly kind: 'audio' | 'image' | 'video';
  readonly path: string;
  /** Provenance is mandatory: unlicensed media cannot back published content. */
  readonly source: string;
  readonly licence: string;
  readonly attribution?: string;
  readonly voice?: string;
  readonly speed?: 'slow' | 'normal' | 'natural';
  readonly variantCode?: string;
  readonly transcript?: string;
}

export interface AuthoredCurriculum {
  readonly languageCode: string;
  readonly courses: readonly AuthoredCourse[];
  readonly vocabulary: readonly AuthoredVocabulary[];
  readonly grammar: readonly AuthoredGrammar[];
  readonly culture: readonly AuthoredCulture[];
  readonly scenarios: readonly AuthoredScenario[];
  readonly media: readonly AuthoredMedia[];
}
