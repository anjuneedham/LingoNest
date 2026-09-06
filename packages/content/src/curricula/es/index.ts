import type { AuthoredCurriculum } from '../../dsl/types';
import { ES_PRE_A1 } from './preA1';
import { ES_A1 } from './a1';
import { ES_A2 } from './a2';
import { ES_VOCABULARY } from './vocabulary';
import { ES_GRAMMAR } from './grammar';
import { ES_CULTURE } from './culture';
import { ES_SCENARIOS } from './scenarios';
import { ES_MEDIA } from './media';

/**
 * Spanish curriculum.
 *
 * Pre-A1 and A1 are complete; A2 covers the first five units. B1 upward is
 * authored on the rolling schedule in docs/16-mvp-roadmap.md — the structure
 * below is what the seed script reads, so adding a level is adding a course to
 * this array and nothing else.
 */
export const ES_CURRICULUM: AuthoredCurriculum = {
  languageCode: 'es',
  courses: [ES_PRE_A1, ES_A1, ES_A2],
  vocabulary: ES_VOCABULARY,
  grammar: ES_GRAMMAR,
  culture: ES_CULTURE,
  scenarios: ES_SCENARIOS,
  media: ES_MEDIA,
};
