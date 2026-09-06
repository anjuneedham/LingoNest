import { ACTIVITY_TYPES, type ActivityType } from '@lingonest/core';
import type { ActivityRenderer } from '../types';
import { ChoiceActivity } from './ChoiceActivity';
import { MultiAnswerActivity } from './MultiAnswerActivity';
import { TokenBuilderActivity } from './TokenBuilderActivity';
import { FillBlankActivity } from './FillBlankActivity';
import { TextAnswerActivity } from './TextAnswerActivity';
import { MatchActivity } from './MatchActivity';
import { CategorizeActivity } from './CategorizeActivity';
import { ListeningActivity } from './ListeningActivity';
import { SpeakingActivity } from './SpeakingActivity';
import { FlashcardActivity } from './FlashcardActivity';
import { ConversationActivity } from './ConversationActivity';
import { TimedChallengeActivity } from './TimedChallengeActivity';
import { DialogueActivity } from './DialogueActivity';
import { ReviewChallengeActivity } from './ReviewChallengeActivity';

/**
 * Every activity type maps to a renderer.
 *
 * The `Record<ActivityType, …>` type is the point: adding a type to the registry
 * in @lingonest/core without adding a renderer here is a compile error, not a
 * blank screen in a lesson.
 */
export const ACTIVITY_RENDERERS: Record<ActivityType, ActivityRenderer> = {
  multiple_choice: ChoiceActivity,
  multiple_answer: MultiAnswerActivity,
  tap_translation: ChoiceActivity,
  fill_blank: FillBlankActivity,
  drag_drop: CategorizeActivity,
  sentence_order: TokenBuilderActivity,
  word_match: MatchActivity,
  image_match: ChoiceActivity,
  audio_recognition: ListeningActivity,
  listening_comprehension: ListeningActivity,
  pronunciation_repeat: SpeakingActivity,
  speech_response: SpeakingActivity,
  written_response: TextAnswerActivity,
  translation: TextAnswerActivity,
  conversation: ConversationActivity,
  roleplay: ConversationActivity,
  flashcard: FlashcardActivity,
  dictation: ListeningActivity,
  spelling: TextAnswerActivity,
  grammar_correction: TextAnswerActivity,
  word_categorization: CategorizeActivity,
  story_completion: FillBlankActivity,
  dialogue_completion: DialogueActivity,
  scenario_simulation: ConversationActivity,
  timed_challenge: TimedChallengeActivity,
  review_challenge: ReviewChallengeActivity,
};

export function rendererFor(type: ActivityType): ActivityRenderer {
  return ACTIVITY_RENDERERS[type];
}

/** Asserted by a test: no type may be left without a renderer. */
export const RENDERED_TYPES = ACTIVITY_TYPES;
