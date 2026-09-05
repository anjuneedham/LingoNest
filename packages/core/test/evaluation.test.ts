import { describe, expect, it } from 'vitest';
import { activitySchema, type Activity } from '../src/activities/types';
import { evaluateAnswer, defaultContext } from '../src/evaluation/evaluate';
import { guardAiVerdict } from '../src/evaluation/aiVerdict';
import { editDistance, normalizeText, similarity } from '../src/evaluation/normalize';

function activity(partial: Partial<Activity> & Pick<Activity, 'type'>): Activity {
  return activitySchema.parse({
    id: 'a1',
    ordinal: 0,
    stage: 'practice',
    skill: 'grammar',
    cefr: 'A1',
    difficulty: 1,
    prompt: {},
    hints: [],
    media: [],
    points: 10,
    tags: [],
    variants: [],
    ...partial,
  });
}

describe('normalisation', () => {
  it('ignores case, punctuation and extra spacing', () => {
    expect(normalizeText('  Hola,   ¿Cómo estás?  ')).toBe('hola ¿cómo estás');
  });

  it('measures edit distance and similarity', () => {
    expect(editDistance('gato', 'gato')).toBe(0);
    expect(editDistance('gato', 'gatos')).toBe(1);
    expect(similarity('gato', 'gato')).toBe(1);
    expect(similarity('gato', 'perro')).toBeLessThan(0.5);
  });
});

describe('multiple choice', () => {
  const mcq = activity({
    type: 'multiple_choice',
    prompt: {
      question: 'How do you say "hello"?',
      options: [
        { id: 'a', text: 'Hola' },
        { id: 'b', text: 'Adiós' },
      ],
      shuffle: true,
    },
    correctAnswer: 'a',
    explanation: 'Hola is the standard greeting.',
  });

  it('accepts the right option', () => {
    const v = evaluateAnswer(mcq, { optionId: 'a' }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(true);
    expect(v.score).toBe(1);
  });

  it('rejects the wrong option and explains why', () => {
    const v = evaluateAnswer(mcq, { optionId: 'b' }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(false);
    expect(v.feedback).toEqual({ yours: 'Adiós', better: 'Hola', why: 'Hola is the standard greeting.' });
  });

  it('rejects a malformed answer instead of crashing', () => {
    const v = evaluateAnswer(mcq, { nonsense: true }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(false);
    expect(v.errorTags).toContain('malformed_answer');
  });
});

describe('multiple answer', () => {
  const activityDef = activity({
    type: 'multiple_answer',
    skill: 'vocabulary',
    prompt: {
      question: 'Which of these are fruits?',
      options: [
        { id: 'a', text: 'manzana' },
        { id: 'b', text: 'plátano' },
        { id: 'c', text: 'silla' },
      ],
      partialCredit: true,
    },
    correctAnswer: ['a', 'b'],
  });

  it('requires the whole set', () => {
    expect(evaluateAnswer(activityDef, { optionIds: ['a', 'b'] }, defaultContext('es', 'A1')).correct).toBe(true);
  });

  it('gives no mastery credit for a partial set but marks it partial', () => {
    const v = evaluateAnswer(activityDef, { optionIds: ['a'] }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(false);
    expect(v.partial).toBe(true);
    expect(v.score).toBe(0);
  });

  it('penalises over-selection', () => {
    const v = evaluateAnswer(activityDef, { optionIds: ['a', 'b', 'c'] }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(false);
  });
});

describe('open text grading pipeline', () => {
  const translate = activity({
    type: 'translation',
    skill: 'mediation',
    cefr: 'A1',
    prompt: { source: 'I am 25 years old.', direction: 'native_to_target' },
    correctAnswer: 'Tengo 25 años',
    acceptableAnswers: ['Tengo veinticinco años'],
    explanation: 'Spanish expresses age with tener, not ser.',
  });

  it('accepts the exact answer', () => {
    expect(evaluateAnswer(translate, { text: 'Tengo 25 años' }, defaultContext('es', 'A1')).correct).toBe(true);
  });

  it('accepts an authored variant', () => {
    expect(
      evaluateAnswer(translate, { text: 'tengo veinticinco años.' }, defaultContext('es', 'A1')).correct,
    ).toBe(true);
  });

  it('accepts a dropped subject pronoun in Spanish', () => {
    expect(evaluateAnswer(translate, { text: 'Yo tengo 25 años' }, defaultContext('es', 'A1')).correct).toBe(true);
  });

  it('forgives a missing accent at A1 but flags it', () => {
    const v = evaluateAnswer(translate, { text: 'Tengo 25 anos' }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(true);
    expect(v.notes).toContain('accent');
    expect(v.score).toBeLessThan(1);
  });

  it('marks the same accent error wrong at B1', () => {
    const b1 = activity({ ...translate, cefr: 'B1' } as Partial<Activity> & Pick<Activity, 'type'>);
    const v = evaluateAnswer(b1, { text: 'Tengo 25 anos' }, { ...defaultContext('es', 'B1') });
    expect(v.correct).toBe(false);
    expect(v.errorTags).toContain('accent');
  });

  it('treats a close miss as a typo with targeted feedback', () => {
    const v = evaluateAnswer(translate, { text: 'Tengo 25 añoss' }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(false);
    expect(v.errorTags).toContain('typo');
    expect(v.feedback?.better).toBe('Tengo 25 años');
  });

  it('hands a genuinely different answer to the AI evaluator', () => {
    const v = evaluateAnswer(translate, { text: 'Soy veinticinco de edad' }, defaultContext('es', 'A1'));
    expect(v.needsAi).toBe(true);
  });

  it('never asks the AI for an empty answer', () => {
    const v = evaluateAnswer(translate, { text: '   ' }, defaultContext('es', 'A1'));
    expect(v.needsAi).toBe(false);
    expect(v.errorTags).toContain('empty');
  });
});

describe('fill in the blank', () => {
  const fill = activity({
    type: 'fill_blank',
    prompt: { template: 'Yo {{blank}} español.', caseSensitive: false },
    correctAnswer: ['hablo'],
    acceptableAnswers: [['estudio']],
    explanation: 'The -o ending marks the first person singular.',
  });

  it('accepts the primary answer', () => {
    expect(evaluateAnswer(fill, { blanks: ['hablo'] }, defaultContext('es', 'A1')).correct).toBe(true);
  });

  it('accepts a per-blank alternative', () => {
    expect(evaluateAnswer(fill, { blanks: ['estudio'] }, defaultContext('es', 'A1')).correct).toBe(true);
  });

  it('rejects a wrong conjugation with feedback', () => {
    const v = evaluateAnswer(fill, { blanks: ['hablas'] }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(false);
    expect(v.feedback?.why).toContain('first person');
  });
});

describe('sentence building', () => {
  const build = activity({
    type: 'sentence_order',
    stage: 'build',
    prompt: { instruction: 'Build the sentence.', tokens: ['Hola', 'me', 'llamo', 'Ana'] },
    correctAnswer: ['Hola', 'me', 'llamo', 'Ana'],
  });

  it('accepts the target order', () => {
    expect(
      evaluateAnswer(build, { tokens: ['Hola', 'me', 'llamo', 'Ana'] }, defaultContext('es', 'A1')).correct,
    ).toBe(true);
  });

  it('distinguishes word-order errors from wrong words', () => {
    const reordered = evaluateAnswer(build, { tokens: ['me', 'llamo', 'Hola', 'Ana'] }, defaultContext('es', 'A1'));
    expect(reordered.errorTags).toContain('word_order');
    const wrongWords = evaluateAnswer(build, { tokens: ['Hola', 'soy', 'Ana'] }, defaultContext('es', 'A1'));
    expect(wrongWords.errorTags).toContain('construction');
  });
});

describe('pronunciation', () => {
  const speak = activity({
    type: 'pronunciation_repeat',
    stage: 'speak',
    skill: 'pronunciation',
    prompt: { target: 'Buenos días', focusPhonemes: ['b', 'd'] },
  });

  it('accepts a close transcript', () => {
    const v = evaluateAnswer(speak, { transcript: 'buenos dias', confidence: 0.9 }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(true);
  });

  it('reports the focus phonemes when the attempt is off', () => {
    const v = evaluateAnswer(speak, { transcript: 'vamos a casa' }, defaultContext('es', 'A1'));
    expect(v.correct).toBe(false);
    expect(v.errorTags).toContain('phoneme:b');
  });

  it('records but does not score an attempt with no recogniser', () => {
    const v = evaluateAnswer(speak, { transcript: '', selfReported: true }, defaultContext('es', 'A1'));
    expect(v.score).toBe(0);
    expect(v.notes).toContain('unscored_self_reported');
  });

  it('reports when no speech was detected', () => {
    const v = evaluateAnswer(speak, { transcript: '' }, defaultContext('es', 'A1'));
    expect(v.errorTags).toContain('no_speech_detected');
  });
});

describe('hints and retries reduce mastery credit', () => {
  const mcq = activity({
    type: 'multiple_choice',
    prompt: { question: 'q', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], shuffle: false },
    correctAnswer: 'a',
  });

  it('reduces the score per hint', () => {
    const clean = evaluateAnswer(mcq, { optionId: 'a' }, defaultContext('es', 'A1'));
    const hinted = evaluateAnswer(mcq, { optionId: 'a' }, { ...defaultContext('es', 'A1'), hintsUsed: 2 });
    expect(hinted.score).toBeLessThan(clean.score);
    expect(hinted.correct).toBe(true);
  });

  it('scores zero when the answer was revealed', () => {
    const revealed = evaluateAnswer(mcq, { optionId: 'a' }, { ...defaultContext('es', 'A1'), hintsUsed: 4 });
    expect(revealed.score).toBe(0);
  });

  it('reduces the score on a retry', () => {
    const retry = evaluateAnswer(mcq, { optionId: 'a' }, { ...defaultContext('es', 'A1'), attemptNumber: 2 });
    expect(retry.score).toBeLessThan(1);
  });
});

describe('AI verdicts are not trusted blindly', () => {
  const writing = activity({
    type: 'written_response',
    skill: 'writing',
    stage: 'apply',
    cefr: 'B1',
    prompt: { task: 'Describe your last holiday.' },
    rubric: { goal: 'Describe a past holiday', criteria: ['past tense'], mustInclude: ['fui'] },
  });

  it('rejects a response the model claims is correct but is in the wrong language', () => {
    const v = guardAiVerdict(
      { correct: true, score: 1, detectedLanguage: 'en' },
      writing,
      { targetLanguage: 'es', learnerText: 'I went to the beach last summer.' },
    );
    expect(v.correct).toBe(false);
    expect(v.notes).toContain('wrong_language');
  });

  it('rejects a correct verdict with no content overlap with the reference', () => {
    const v = guardAiVerdict(
      { correct: true, score: 1 },
      writing,
      { targetLanguage: 'es', learnerText: 'zzz qqq', reference: 'Fui a la playa con mi familia' },
    );
    expect(v.correct).toBe(false);
    expect(v.notes).toContain('no_content_overlap');
  });

  it('enforces rubric requirements in code, not by asking the model nicely', () => {
    const v = guardAiVerdict(
      { correct: true, score: 1 },
      writing,
      { targetLanguage: 'es', learnerText: 'Estuve en la playa con mi familia' },
    );
    expect(v.correct).toBe(false);
    expect(v.notes.some((n) => n.startsWith('missing_required'))).toBe(true);
  });

  it('accepts a credible verdict', () => {
    const v = guardAiVerdict(
      {
        correct: true,
        score: 0.9,
        errors: [],
        better: 'Fui a la playa con mi familia.',
        why: 'Good use of the preterite.',
        strengths: ['past tense'],
        detectedLanguage: 'es',
      },
      writing,
      { targetLanguage: 'es', learnerText: 'Fui a la playa con mi familia', reference: 'Fui a la playa' },
    );
    expect(v.correct).toBe(true);
    expect(v.score).toBeCloseTo(0.9);
  });

  it('rejects a response that does not match the contract', () => {
    const v = guardAiVerdict({ nonsense: true }, writing, { targetLanguage: 'es', learnerText: 'algo' });
    expect(v.correct).toBe(false);
    expect(v.errorTags).toContain('ai_invalid_response');
  });
});
