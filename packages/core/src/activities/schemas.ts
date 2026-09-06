import { z } from 'zod';

/**
 * Prompt and answer shapes for each activity type. The CMS generates its editor
 * forms from these schemas, the seed pipeline validates against them, and the
 * client parses with them before rendering — so a malformed activity is caught
 * at authoring time rather than blanking a screen mid-lesson.
 */

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  imageAssetKey: z.string().optional(),
  audioAssetKey: z.string().optional(),
});

const pairSchema = z.object({
  left: z.string().min(1),
  right: z.string().min(1),
  imageAssetKey: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export const promptSchemas = {
  multiple_choice: z.object({
    question: z.string().min(1),
    options: z.array(optionSchema).min(2),
    shuffle: z.boolean().default(true),
  }),
  multiple_answer: z.object({
    question: z.string().min(1),
    options: z.array(optionSchema).min(3),
    /** Partial credit when the learner gets some but not all. */
    partialCredit: z.boolean().default(true),
  }),
  tap_translation: z.object({
    source: z.string().min(1),
    direction: z.enum(['target_to_native', 'native_to_target']),
    options: z.array(optionSchema).min(2),
  }),
  fill_blank: z.object({
    /** Sentence with `{{blank}}` markers, one per blank. */
    template: z.string().min(1),
    /** Optional word bank; absent means free typing. */
    wordBank: z.array(z.string()).optional(),
    caseSensitive: z.boolean().default(false),
  }),
  drag_drop: z.object({
    instruction: z.string().min(1),
    items: z.array(z.string().min(1)).min(2),
    targets: z.array(z.string().min(1)).min(2),
  }),
  sentence_order: z.object({
    instruction: z.string().min(1),
    tokens: z.array(z.string().min(1)).min(2),
  }),
  word_match: z.object({
    instruction: z.string().min(1),
    pairs: z.array(pairSchema).min(2),
  }),
  image_match: z.object({
    instruction: z.string().min(1),
    word: z.string().min(1),
    options: z.array(optionSchema.extend({ imageAssetKey: z.string().min(1) })).min(2),
  }),
  audio_recognition: z.object({
    instruction: z.string().min(1),
    options: z.array(optionSchema).min(2),
  }),
  listening_comprehension: z.object({
    instruction: z.string().min(1),
    question: z.string().min(1),
    options: z.array(optionSchema).optional(),
    /** Absent options means an open answer graded against acceptable answers. */
    allowReplay: z.boolean().default(true),
    showTranscriptAfter: z.boolean().default(true),
  }),
  pronunciation_repeat: z.object({
    target: z.string().min(1),
    phonetic: z.string().optional(),
    focusPhonemes: z.array(z.string()).default([]),
  }),
  speech_response: z.object({
    situation: z.string().min(1),
    question: z.string().min(1),
    expectedFunctions: z.array(z.string()).default([]),
  }),
  written_response: z.object({
    task: z.string().min(1),
    minWords: z.number().int().positive().optional(),
    maxWords: z.number().int().positive().optional(),
  }),
  translation: z.object({
    source: z.string().min(1),
    direction: z.enum(['target_to_native', 'native_to_target']),
  }),
  conversation: z.object({
    scenarioKey: z.string().min(1),
    goals: z.array(z.string().min(1)).min(1),
    minTurns: z.number().int().positive().default(4),
  }),
  roleplay: z.object({
    scenarioKey: z.string().min(1),
    learnerRole: z.string().min(1),
    partnerRole: z.string().min(1),
    goals: z.array(z.string().min(1)).min(1),
  }),
  flashcard: z.object({
    vocabularyId: z.string().min(1),
    front: z.string().min(1),
    back: z.string().min(1),
    example: z.string().optional(),
  }),
  dictation: z.object({
    instruction: z.string().min(1),
    /** The learner hears audio and types what they hear. */
    allowReplay: z.boolean().default(true),
  }),
  spelling: z.object({
    instruction: z.string().min(1),
    /** Optional scrambled letters for a tap-to-build variant. */
    letters: z.array(z.string().min(1)).optional(),
  }),
  grammar_correction: z.object({
    instruction: z.string().min(1),
    incorrectSentence: z.string().min(1),
    grammarTopicId: z.string().optional(),
  }),
  word_categorization: z.object({
    instruction: z.string().min(1),
    categories: z.array(z.string().min(1)).min(2),
    words: z.array(z.string().min(1)).min(2),
  }),
  story_completion: z.object({
    story: z.string().min(1),
    /** Ordered gaps in the story text, marked `{{blank}}`. */
    wordBank: z.array(z.string()).optional(),
  }),
  dialogue_completion: z.object({
    lines: z
      .array(z.object({ speaker: z.string().min(1), text: z.string(), isGap: z.boolean().default(false) }))
      .min(2),
    options: z.array(optionSchema).optional(),
  }),
  scenario_simulation: z.object({
    situation: z.string().min(1),
    goals: z.array(z.string().min(1)).min(1),
    constraints: z.array(z.string()).default([]),
  }),
  timed_challenge: z.object({
    instruction: z.string().min(1),
    items: z
      .array(z.object({ id: z.string().min(1), question: z.string().min(1), answer: z.string().min(1) }))
      .min(3),
  }),
  review_challenge: z.object({
    instruction: z.string().min(1),
    /** Populated at runtime from the learner's SRS queue. */
    source: z.enum(['srs_due', 'recent_mistakes', 'lesson_vocabulary']),
    itemCount: z.number().int().positive().default(10),
  }),
} as const;

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

const textAnswer = z.object({ text: z.string() });
const idAnswer = z.object({ optionId: z.string().min(1) });
const idsAnswer = z.object({ optionIds: z.array(z.string().min(1)) });
const tokensAnswer = z.object({ tokens: z.array(z.string()) });
const blanksAnswer = z.object({ blanks: z.array(z.string()) });
const pairsAnswer = z.object({ pairs: z.array(z.object({ left: z.string(), right: z.string() })) });
const mappingAnswer = z.object({ mapping: z.record(z.string(), z.string()) });
const transcriptAnswer = z.object({
  transcript: z.string(),
  /** Present when the device's recogniser reported a confidence score. */
  confidence: z.number().min(0).max(1).optional(),
  /** True when speech recognition was unavailable and the learner self-reported. */
  selfReported: z.boolean().optional(),
});
const selfGradeAnswer = z.object({ quality: z.enum(['again', 'hard', 'good', 'easy']) });
const turnsAnswer = z.object({
  turns: z.array(z.object({ role: z.enum(['learner', 'partner']), text: z.string() })),
  goalsAchieved: z.array(z.string()).default([]),
});
const itemsAnswer = z.object({
  items: z.array(z.object({ id: z.string(), text: z.string(), elapsedMs: z.number().nonnegative() })),
});

export const answerSchemas = {
  multiple_choice: idAnswer,
  multiple_answer: idsAnswer,
  tap_translation: idAnswer,
  fill_blank: blanksAnswer,
  drag_drop: mappingAnswer,
  sentence_order: tokensAnswer,
  word_match: pairsAnswer,
  image_match: idAnswer,
  audio_recognition: idAnswer,
  listening_comprehension: z.union([idAnswer, textAnswer]),
  pronunciation_repeat: transcriptAnswer,
  speech_response: transcriptAnswer,
  written_response: textAnswer,
  translation: textAnswer,
  conversation: turnsAnswer,
  roleplay: turnsAnswer,
  flashcard: selfGradeAnswer,
  dictation: textAnswer,
  spelling: textAnswer,
  grammar_correction: textAnswer,
  word_categorization: mappingAnswer,
  story_completion: blanksAnswer,
  dialogue_completion: z.union([idAnswer, blanksAnswer]),
  scenario_simulation: turnsAnswer,
  timed_challenge: itemsAnswer,
  review_challenge: itemsAnswer,
} as const;

export type PromptOf<T extends keyof typeof promptSchemas> = z.infer<(typeof promptSchemas)[T]>;
export type AnswerOf<T extends keyof typeof answerSchemas> = z.infer<(typeof answerSchemas)[T]>;
