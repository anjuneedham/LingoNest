/**
 * The nine tracked ability dimensions. A learner has an *overall* estimate plus
 * an independent estimate per skill, because real learners are uneven — someone
 * who reads at B2 may write at A2+ (brief §12).
 */
export const SKILLS = [
  'reading',
  'listening',
  'speaking',
  'writing',
  'vocabulary',
  'grammar',
  'pronunciation',
  'interaction',
  'mediation',
] as const;

export type Skill = (typeof SKILLS)[number];

/** Skills that contribute to the headline "overall" estimate, and their weights. */
export const OVERALL_WEIGHTS: Record<Skill, number> = {
  listening: 1,
  reading: 1,
  speaking: 1,
  writing: 1,
  vocabulary: 0.75,
  grammar: 0.75,
  interaction: 0.5,
  pronunciation: 0.25,
  mediation: 0.25,
};

export const SKILL_LABEL_KEYS: Record<Skill, string> = {
  reading: 'skills.reading',
  listening: 'skills.listening',
  speaking: 'skills.speaking',
  writing: 'skills.writing',
  vocabulary: 'skills.vocabulary',
  grammar: 'skills.grammar',
  pronunciation: 'skills.pronunciation',
  interaction: 'skills.interaction',
  mediation: 'skills.mediation',
};

export function isSkill(value: string): value is Skill {
  return (SKILLS as readonly string[]).includes(value);
}
