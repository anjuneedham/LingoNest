import type { Cefr, Hint, Skill } from '@lingonest/core';
import type { AuthoredActivity, AuthoredCourse, AuthoredLesson, AuthoredUnit } from './types';

/**
 * Authoring builders.
 *
 * The point of these is that a lesson author writes the interesting part — the
 * Spanish, the answer, why a wrong answer is wrong — and never writes ordinals,
 * stage names or point values. A lesson is ~20 lines instead of ~200, which is
 * what makes authoring ten units per level realistic.
 *
 * Note there is no `intro()` builder: the lesson's own objective and can-do
 * statement are what the introduction screen renders. Inventing a fake
 * "activity" for it would put an un-gradable item in the attempt stream.
 */

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${(counter += 1).toString(36)}`;

export function hints(...texts: [string, ...string[]]): Hint[] {
  const kinds: Hint['kind'][] = ['context', 'vocabulary', 'grammar', 'partial', 'answer'];
  return texts.map((text, index) => ({
    level: index + 1,
    kind: kinds[Math.min(index, kinds.length - 1)]!,
    text,
  }));
}

interface Option {
  readonly id?: string;
  readonly text: string;
  readonly image?: string;
  readonly audio?: string;
}

function options(list: readonly (string | Option)[]): { id: string; text: string; imageAssetKey?: string; audioAssetKey?: string }[] {
  return list.map((entry, index) => {
    const option = typeof entry === 'string' ? { text: entry } : entry;
    return {
      id: option.id ?? String.fromCharCode(97 + index),
      text: option.text,
      ...(option.image ? { imageAssetKey: option.image } : {}),
      ...(option.audio ? { audioAssetKey: option.audio } : {}),
    };
  });
}

function optionIdFor(list: readonly (string | Option)[], answer: string): string {
  const built = options(list);
  const match = built.find((o) => o.text === answer || o.id === answer);
  if (!match) {
    throw new Error(`Answer "${answer}" is not one of the options: ${built.map((o) => o.text).join(' | ')}`);
  }
  return match.id;
}

// ---------------------------------------------------------------------------
// Comprehension and vocabulary
// ---------------------------------------------------------------------------

export function mcq(input: {
  question: string;
  options: readonly (string | Option)[];
  answer: string;
  why?: string;
  hints?: readonly Hint[];
  skill?: Skill;
  stage?: AuthoredActivity['stage'];
  cefr?: Cefr;
  difficulty?: AuthoredActivity['difficulty'];
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'multiple_choice',
    stage: input.stage ?? 'practice',
    skill: input.skill ?? 'vocabulary',
    cefr: input.cefr,
    difficulty: input.difficulty,
    prompt: { question: input.question, options: options(input.options), shuffle: true },
    correctAnswer: optionIdFor(input.options, input.answer),
    explanation: input.why,
    hints: input.hints,
    tags: input.tags,
  };
}

export function multiAnswer(input: {
  question: string;
  options: readonly (string | Option)[];
  answers: readonly string[];
  why?: string;
  skill?: Skill;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'multiple_answer',
    stage: 'practice',
    skill: input.skill ?? 'vocabulary',
    prompt: { question: input.question, options: options(input.options), partialCredit: true },
    correctAnswer: input.answers.map((a) => optionIdFor(input.options, a)),
    explanation: input.why,
    tags: input.tags,
  };
}

export function tapTranslation(input: {
  source: string;
  options: readonly string[];
  answer: string;
  direction?: 'target_to_native' | 'native_to_target';
  why?: string;
  hints?: readonly Hint[];
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'tap_translation',
    stage: 'understand',
    skill: 'reading',
    prompt: {
      source: input.source,
      direction: input.direction ?? 'target_to_native',
      options: options(input.options),
    },
    correctAnswer: optionIdFor(input.options, input.answer),
    explanation: input.why,
    hints: input.hints,
    tags: input.tags,
  };
}

export function wordMatch(input: {
  instruction: string;
  pairs: readonly (readonly [string, string])[];
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'word_match',
    stage: 'discover',
    skill: 'vocabulary',
    prompt: {
      instruction: input.instruction,
      pairs: input.pairs.map(([left, right]) => ({ left, right })),
    },
    correctAnswer: Object.fromEntries(input.pairs.map(([left, right]) => [left, right])),
    tags: input.tags,
  };
}

export function imageMatch(input: {
  instruction: string;
  word: string;
  options: readonly { text: string; image: string }[];
  answer: string;
  tags?: readonly string[];
}): AuthoredActivity {
  const built = options(input.options.map((o) => ({ text: o.text, image: o.image })));
  const match = built.find((o) => o.text === input.answer);
  if (!match) throw new Error(`Image answer "${input.answer}" is not among the options`);
  return {
    type: 'image_match',
    stage: 'discover',
    skill: 'vocabulary',
    prompt: { instruction: input.instruction, word: input.word, options: built },
    correctAnswer: match.id,
    media: input.options.map((o) => ({ assetKey: o.image, kind: 'image' as const, altText: o.text })),
    tags: input.tags,
  };
}

export function categorize(input: {
  instruction: string;
  categories: readonly string[];
  mapping: Readonly<Record<string, string>>;
  why?: string;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'word_categorization',
    stage: 'practice',
    skill: 'vocabulary',
    prompt: {
      instruction: input.instruction,
      categories: input.categories,
      words: Object.keys(input.mapping),
    },
    correctAnswer: input.mapping,
    explanation: input.why,
    tags: input.tags,
  };
}

export function dragDrop(input: {
  instruction: string;
  mapping: Readonly<Record<string, string>>;
  why?: string;
  skill?: Skill;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'drag_drop',
    stage: 'practice',
    skill: input.skill ?? 'grammar',
    prompt: {
      instruction: input.instruction,
      items: Object.keys(input.mapping),
      targets: [...new Set(Object.values(input.mapping))],
    },
    correctAnswer: input.mapping,
    explanation: input.why,
    tags: input.tags,
  };
}

// ---------------------------------------------------------------------------
// Listening
// ---------------------------------------------------------------------------

export function listen(input: {
  audio: string;
  question: string;
  options?: readonly string[];
  answer: string;
  transcript?: string;
  speed?: 'slow' | 'normal' | 'natural';
  instruction?: string;
  why?: string;
  hints?: readonly Hint[];
  cefr?: Cefr;
  tags?: readonly string[];
}): AuthoredActivity {
  const hasOptions = input.options !== undefined && input.options.length > 0;
  return {
    type: 'listening_comprehension',
    stage: 'understand',
    skill: 'listening',
    cefr: input.cefr,
    prompt: {
      instruction: input.instruction ?? 'Listen and answer.',
      question: input.question,
      ...(hasOptions ? { options: options(input.options!) } : {}),
      allowReplay: true,
      showTranscriptAfter: true,
    },
    correctAnswer: hasOptions ? optionIdFor(input.options!, input.answer) : input.answer,
    media: [{ assetKey: input.audio, kind: 'audio', speed: input.speed ?? 'normal', transcript: input.transcript }],
    explanation: input.why,
    hints: input.hints,
    tags: input.tags,
  };
}

export function audioChoice(input: {
  audio: string;
  instruction: string;
  options: readonly string[];
  answer: string;
  speed?: 'slow' | 'normal' | 'natural';
  why?: string;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'audio_recognition',
    stage: 'listen',
    skill: 'listening',
    explanation: input.why,
    prompt: { instruction: input.instruction, options: options(input.options) },
    correctAnswer: optionIdFor(input.options, input.answer),
    media: [{ assetKey: input.audio, kind: 'audio', speed: input.speed ?? 'slow' }],
    tags: input.tags,
  };
}

export function dictation(input: {
  audio: string;
  answer: string;
  alternatives?: readonly string[];
  instruction?: string;
  speed?: 'slow' | 'normal' | 'natural';
  why?: string;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'dictation',
    stage: 'practice',
    skill: 'listening',
    prompt: { instruction: input.instruction ?? 'Listen and type what you hear.', allowReplay: true },
    correctAnswer: input.answer,
    acceptableAnswers: input.alternatives,
    media: [{ assetKey: input.audio, kind: 'audio', speed: input.speed ?? 'slow', transcript: input.answer }],
    explanation: input.why,
    tags: input.tags,
  };
}

// ---------------------------------------------------------------------------
// Production: grammar, writing, speaking
// ---------------------------------------------------------------------------

export function fillBlank(input: {
  template: string;
  answers: readonly string[];
  alternatives?: readonly (readonly string[])[];
  wordBank?: readonly string[];
  why: string;
  hints?: readonly Hint[];
  skill?: Skill;
  cefr?: Cefr;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'fill_blank',
    stage: 'practice',
    skill: input.skill ?? 'grammar',
    cefr: input.cefr,
    prompt: {
      template: input.template,
      ...(input.wordBank ? { wordBank: input.wordBank } : {}),
      caseSensitive: false,
    },
    correctAnswer: input.answers,
    acceptableAnswers: input.alternatives,
    explanation: input.why,
    hints: input.hints,
    tags: input.tags,
  };
}

export function buildSentence(input: {
  target: string;
  tokens: readonly string[];
  alternatives?: readonly (readonly string[])[];
  instruction?: string;
  why?: string;
  hints?: readonly Hint[];
  cefr?: Cefr;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'sentence_order',
    stage: 'build',
    skill: 'grammar',
    cefr: input.cefr,
    prompt: { instruction: input.instruction ?? 'Put the words in order.', tokens: input.tokens },
    correctAnswer: input.target.split(' '),
    acceptableAnswers: input.alternatives,
    explanation: input.why,
    hints: input.hints,
    tags: input.tags,
  };
}

export function correctGrammar(input: {
  incorrect: string;
  correct: string;
  why: string;
  alternatives?: readonly string[];
  instruction?: string;
  topic?: string;
  hints?: readonly Hint[];
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'grammar_correction',
    stage: 'practice',
    skill: 'grammar',
    prompt: {
      instruction: input.instruction ?? 'Correct the sentence.',
      incorrectSentence: input.incorrect,
      ...(input.topic ? { grammarTopicId: input.topic } : {}),
    },
    correctAnswer: input.correct,
    acceptableAnswers: input.alternatives,
    explanation: input.why,
    hints: input.hints,
    tags: input.tags ?? (input.topic ? [`grammar:${input.topic}`] : undefined),
  };
}

export function translate(input: {
  source: string;
  answer: string;
  alternatives?: readonly string[];
  direction?: 'target_to_native' | 'native_to_target';
  why: string;
  hints?: readonly Hint[];
  cefr?: Cefr;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'translation',
    stage: 'practice',
    skill: 'mediation',
    cefr: input.cefr,
    prompt: { source: input.source, direction: input.direction ?? 'native_to_target' },
    correctAnswer: input.answer,
    acceptableAnswers: input.alternatives,
    explanation: input.why,
    hints: input.hints,
    tags: input.tags,
  };
}

export function spelling(input: {
  instruction: string;
  answer: string;
  letters?: readonly string[];
  why?: string;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'spelling',
    stage: 'practice',
    skill: 'writing',
    prompt: {
      instruction: input.instruction,
      ...(input.letters ? { letters: input.letters } : {}),
    },
    correctAnswer: input.answer,
    explanation: input.why,
    tags: input.tags,
  };
}

export function speak(input: {
  target: string;
  audio?: string;
  phonetic?: string;
  focusPhonemes?: readonly string[];
  why?: string;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'pronunciation_repeat',
    stage: 'speak',
    skill: 'pronunciation',
    prompt: {
      target: input.target,
      ...(input.phonetic ? { phonetic: input.phonetic } : {}),
      focusPhonemes: input.focusPhonemes ?? [],
    },
    media: input.audio ? [{ assetKey: input.audio, kind: 'audio' as const, speed: 'slow' as const }] : [],
    explanation: input.why,
    tags: input.tags,
  };
}

export function speakResponse(input: {
  situation: string;
  question: string;
  goal: string;
  criteria: readonly string[];
  mustInclude?: readonly string[];
  expectedFunctions?: readonly string[];
  hints?: readonly Hint[];
  cefr?: Cefr;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'speech_response',
    stage: 'speak',
    skill: 'speaking',
    cefr: input.cefr,
    prompt: {
      situation: input.situation,
      question: input.question,
      expectedFunctions: input.expectedFunctions ?? [],
    },
    rubric: { goal: input.goal, criteria: input.criteria, mustInclude: input.mustInclude },
    hints: input.hints,
    tags: input.tags,
  };
}

export function write(input: {
  task: string;
  goal: string;
  criteria: readonly string[];
  minWords?: number;
  maxWords?: number;
  mustInclude?: readonly string[];
  hints?: readonly Hint[];
  cefr?: Cefr;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'written_response',
    stage: 'apply',
    skill: 'writing',
    cefr: input.cefr,
    prompt: {
      task: input.task,
      ...(input.minWords ? { minWords: input.minWords } : {}),
      ...(input.maxWords ? { maxWords: input.maxWords } : {}),
    },
    rubric: {
      goal: input.goal,
      criteria: input.criteria,
      mustInclude: input.mustInclude,
      minWords: input.minWords,
    },
    hints: input.hints,
    tags: input.tags,
  };
}

// ---------------------------------------------------------------------------
// Reading and interaction
// ---------------------------------------------------------------------------

export function storyCompletion(input: {
  story: string;
  answers: readonly string[];
  wordBank?: readonly string[];
  why?: string;
  cefr?: Cefr;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'story_completion',
    stage: 'understand',
    skill: 'reading',
    cefr: input.cefr,
    prompt: { story: input.story, ...(input.wordBank ? { wordBank: input.wordBank } : {}) },
    correctAnswer: input.answers,
    explanation: input.why,
    tags: input.tags,
  };
}

export function dialogueCompletion(input: {
  lines: readonly { speaker: string; text: string; gap?: boolean }[];
  options: readonly string[];
  answer: string;
  why?: string;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'dialogue_completion',
    stage: 'practice',
    skill: 'interaction',
    prompt: {
      lines: input.lines.map((l) => ({ speaker: l.speaker, text: l.text, isGap: l.gap ?? false })),
      options: options(input.options),
    },
    correctAnswer: optionIdFor(input.options, input.answer),
    explanation: input.why,
    tags: input.tags,
  };
}

export function converse(input: {
  scenario: string;
  goals: readonly string[];
  minTurns?: number;
  cefr?: Cefr;
  hints?: readonly Hint[];
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'conversation',
    stage: 'converse',
    skill: 'interaction',
    cefr: input.cefr,
    prompt: { scenarioKey: input.scenario, goals: input.goals, minTurns: input.minTurns ?? 4 },
    rubric: { goal: input.goals[0] ?? 'Complete the conversation', criteria: input.goals },
    hints: input.hints,
    tags: input.tags,
  };
}

export function roleplay(input: {
  scenario: string;
  learnerRole: string;
  partnerRole: string;
  goals: readonly string[];
  cefr?: Cefr;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'roleplay',
    stage: 'converse',
    skill: 'interaction',
    cefr: input.cefr,
    prompt: {
      scenarioKey: input.scenario,
      learnerRole: input.learnerRole,
      partnerRole: input.partnerRole,
      goals: input.goals,
    },
    rubric: { goal: input.goals[0] ?? 'Complete the role-play', criteria: input.goals },
    tags: input.tags,
  };
}

/** The real-world task that closes a unit (brief §78). */
export function realWorldTask(input: {
  situation: string;
  goals: readonly string[];
  constraints?: readonly string[];
  cefr?: Cefr;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'scenario_simulation',
    stage: 'apply',
    skill: 'interaction',
    cefr: input.cefr,
    prompt: { situation: input.situation, goals: input.goals, constraints: input.constraints ?? [] },
    rubric: { goal: input.goals[0] ?? 'Complete the task', criteria: input.goals },
    tags: input.tags,
  };
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export function flashcards(input: {
  vocabulary: readonly { key: string; front: string; back: string; example?: string }[];
}): AuthoredActivity[] {
  return input.vocabulary.map((v) => ({
    type: 'flashcard' as const,
    stage: 'review' as const,
    skill: 'vocabulary' as const,
    prompt: {
      vocabularyId: v.key,
      front: v.front,
      back: v.back,
      ...(v.example ? { example: v.example } : {}),
    },
    tags: [`vocab:${v.key}`],
  }));
}

export function timedChallenge(input: {
  instruction: string;
  items: readonly (readonly [string, string])[];
  seconds?: number;
  tags?: readonly string[];
}): AuthoredActivity {
  return {
    type: 'timed_challenge',
    stage: 'review',
    skill: 'vocabulary',
    prompt: {
      instruction: input.instruction,
      items: input.items.map(([question, answer], index) => ({
        id: `i${index + 1}`,
        question,
        answer,
      })),
    },
    timeLimitSeconds: input.seconds ?? 60,
    tags: input.tags,
  };
}

export function reviewChallenge(input: {
  instruction?: string;
  source?: 'srs_due' | 'recent_mistakes' | 'lesson_vocabulary';
  count?: number;
}): AuthoredActivity {
  return {
    type: 'review_challenge',
    stage: 'review',
    skill: 'vocabulary',
    prompt: {
      instruction: input.instruction ?? 'Review what you have learned.',
      source: input.source ?? 'lesson_vocabulary',
      itemCount: input.count ?? 10,
    },
  };
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export function lesson(input: AuthoredLesson): AuthoredLesson {
  if (input.activities.length === 0) {
    throw new Error(`Lesson "${input.slug}" has no activities`);
  }
  return input;
}

export function unit(input: AuthoredUnit): AuthoredUnit {
  return input;
}

export function course(input: AuthoredCourse): AuthoredCourse {
  return input;
}

export function resetIdCounter(): void {
  counter = 0;
}

export { nextId };
