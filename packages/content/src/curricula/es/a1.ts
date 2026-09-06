import { course } from '../../dsl/builders';
import { ES_A1_UNIT_1, ES_A1_UNIT_2, ES_A1_UNIT_3, ES_A1_UNIT_4, ES_A1_UNIT_5 } from './a1-units-1-5';
import { ES_A1_UNIT_6, ES_A1_UNIT_7, ES_A1_UNIT_8, ES_A1_UNIT_9, ES_A1_UNIT_10 } from './a1-units-6-10';

/**
 * Spanish A1 — survival communication.
 *
 * Ten units, five lessons each, ending in a checkpoint that assesses reading,
 * listening, vocabulary, grammar, speaking and writing separately. Every unit
 * closes with a real-world task the learner can actually go and do.
 */
export const ES_A1 = course({
  slug: 'es-a1-survival',
  title: 'Spanish A1: Getting By',
  description:
    'Introduce yourself, talk about your family and routine, order food, shop, find your way, describe your home, talk about work, and arrange to meet someone — the language you need to survive your first days in a Spanish-speaking place.',
  cefr: 'A1',
  units: [
    ES_A1_UNIT_1,
    ES_A1_UNIT_2,
    ES_A1_UNIT_3,
    ES_A1_UNIT_4,
    ES_A1_UNIT_5,
    ES_A1_UNIT_6,
    ES_A1_UNIT_7,
    ES_A1_UNIT_8,
    ES_A1_UNIT_9,
    ES_A1_UNIT_10,
  ],
});
