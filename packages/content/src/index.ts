/**
 * @lingonest/content — the curriculum, as data.
 *
 * Nothing in this package is a React component and nothing in the app contains
 * a sentence of Spanish, French or Japanese. Content is authored here with the
 * typed DSL, validated, and emitted as JSON that the seed script loads into
 * Postgres and the app caches for offline use.
 */
export * from './dsl';
export * from './languages';

import type { AuthoredCurriculum } from './dsl/types';
import { ES_CURRICULUM } from './curricula/es';
import { EN_CURRICULUM } from './curricula/en';
import { FR_CURRICULUM } from './curricula/fr';
import { JA_CURRICULUM } from './curricula/ja';

export const CURRICULA: readonly AuthoredCurriculum[] = [
  ES_CURRICULUM,
  EN_CURRICULUM,
  FR_CURRICULUM,
  JA_CURRICULUM,
];

export function curriculumFor(languageCode: string): AuthoredCurriculum | undefined {
  return CURRICULA.find((c) => c.languageCode === languageCode);
}

export { ES_CURRICULUM, EN_CURRICULUM, FR_CURRICULUM, JA_CURRICULUM };
