import { ACTIVITY_TYPES, type ActivityType, type EvaluationMode, type LessonStage } from './types';
import type { Skill } from '../skills/skills';
import { answerSchemas, promptSchemas } from './schemas';

export interface ActivityTypeDef {
  readonly type: ActivityType;
  /** Skill this type trains by default; an author may override per activity. */
  readonly skill: Skill;
  /** Lesson stage this type usually belongs to. */
  readonly stage: LessonStage;
  readonly evaluation: EvaluationMode;
  readonly supportsHints: boolean;
  /** Requires a speech recogniser; degrades to unscored practice without one. */
  readonly requiresSpeech: boolean;
  readonly requiresAudio: boolean;
  readonly defaultPoints: number;
  /** i18n key for the author-facing label in the CMS. */
  readonly labelKey: string;
}

export const ACTIVITY_REGISTRY: Readonly<Record<ActivityType, ActivityTypeDef>> = {
  multiple_choice: { type: 'multiple_choice', skill: 'grammar', stage: 'practice', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 10, labelKey: 'activity.multiple_choice' },
  multiple_answer: { type: 'multiple_answer', skill: 'vocabulary', stage: 'practice', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 12, labelKey: 'activity.multiple_answer' },
  tap_translation: { type: 'tap_translation', skill: 'reading', stage: 'understand', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 10, labelKey: 'activity.tap_translation' },
  fill_blank: { type: 'fill_blank', skill: 'grammar', stage: 'practice', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 12, labelKey: 'activity.fill_blank' },
  drag_drop: { type: 'drag_drop', skill: 'grammar', stage: 'practice', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 12, labelKey: 'activity.drag_drop' },
  sentence_order: { type: 'sentence_order', skill: 'grammar', stage: 'build', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 14, labelKey: 'activity.sentence_order' },
  word_match: { type: 'word_match', skill: 'vocabulary', stage: 'discover', evaluation: 'deterministic', supportsHints: false, requiresSpeech: false, requiresAudio: false, defaultPoints: 10, labelKey: 'activity.word_match' },
  image_match: { type: 'image_match', skill: 'vocabulary', stage: 'discover', evaluation: 'deterministic', supportsHints: false, requiresSpeech: false, requiresAudio: false, defaultPoints: 10, labelKey: 'activity.image_match' },
  audio_recognition: { type: 'audio_recognition', skill: 'listening', stage: 'listen', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: true, defaultPoints: 12, labelKey: 'activity.audio_recognition' },
  listening_comprehension: { type: 'listening_comprehension', skill: 'listening', stage: 'understand', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: true, defaultPoints: 15, labelKey: 'activity.listening_comprehension' },
  pronunciation_repeat: { type: 'pronunciation_repeat', skill: 'pronunciation', stage: 'speak', evaluation: 'assisted', supportsHints: false, requiresSpeech: true, requiresAudio: true, defaultPoints: 12, labelKey: 'activity.pronunciation_repeat' },
  speech_response: { type: 'speech_response', skill: 'speaking', stage: 'speak', evaluation: 'ai', supportsHints: true, requiresSpeech: true, requiresAudio: false, defaultPoints: 20, labelKey: 'activity.speech_response' },
  written_response: { type: 'written_response', skill: 'writing', stage: 'apply', evaluation: 'ai', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 20, labelKey: 'activity.written_response' },
  translation: { type: 'translation', skill: 'mediation', stage: 'practice', evaluation: 'assisted', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 15, labelKey: 'activity.translation' },
  conversation: { type: 'conversation', skill: 'interaction', stage: 'converse', evaluation: 'ai', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 30, labelKey: 'activity.conversation' },
  roleplay: { type: 'roleplay', skill: 'interaction', stage: 'converse', evaluation: 'ai', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 30, labelKey: 'activity.roleplay' },
  flashcard: { type: 'flashcard', skill: 'vocabulary', stage: 'review', evaluation: 'deterministic', supportsHints: false, requiresSpeech: false, requiresAudio: false, defaultPoints: 5, labelKey: 'activity.flashcard' },
  dictation: { type: 'dictation', skill: 'listening', stage: 'practice', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: true, defaultPoints: 15, labelKey: 'activity.dictation' },
  spelling: { type: 'spelling', skill: 'writing', stage: 'practice', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 10, labelKey: 'activity.spelling' },
  grammar_correction: { type: 'grammar_correction', skill: 'grammar', stage: 'practice', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 15, labelKey: 'activity.grammar_correction' },
  word_categorization: { type: 'word_categorization', skill: 'vocabulary', stage: 'practice', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 12, labelKey: 'activity.word_categorization' },
  story_completion: { type: 'story_completion', skill: 'reading', stage: 'understand', evaluation: 'assisted', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 18, labelKey: 'activity.story_completion' },
  dialogue_completion: { type: 'dialogue_completion', skill: 'interaction', stage: 'practice', evaluation: 'deterministic', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 15, labelKey: 'activity.dialogue_completion' },
  scenario_simulation: { type: 'scenario_simulation', skill: 'interaction', stage: 'apply', evaluation: 'ai', supportsHints: true, requiresSpeech: false, requiresAudio: false, defaultPoints: 35, labelKey: 'activity.scenario_simulation' },
  timed_challenge: { type: 'timed_challenge', skill: 'vocabulary', stage: 'review', evaluation: 'deterministic', supportsHints: false, requiresSpeech: false, requiresAudio: false, defaultPoints: 20, labelKey: 'activity.timed_challenge' },
  review_challenge: { type: 'review_challenge', skill: 'vocabulary', stage: 'review', evaluation: 'deterministic', supportsHints: false, requiresSpeech: false, requiresAudio: false, defaultPoints: 20, labelKey: 'activity.review_challenge' },
};

export function activityTypeDef(type: ActivityType): ActivityTypeDef {
  return ACTIVITY_REGISTRY[type];
}

export function defaultStageForType(type: ActivityType): LessonStage {
  return ACTIVITY_REGISTRY[type].stage;
}

export function defaultSkillForType(type: ActivityType): Skill {
  return ACTIVITY_REGISTRY[type].skill;
}

export function promptSchemaFor(type: ActivityType) {
  return promptSchemas[type];
}

export function answerSchemaFor(type: ActivityType) {
  return answerSchemas[type];
}

/** Types whose grading can run entirely offline. */
export function offlineGradableTypes(): ActivityType[] {
  return ACTIVITY_TYPES.filter((t) => ACTIVITY_REGISTRY[t].evaluation !== 'ai');
}
