import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPES, LESSON_STAGES, activitySchema } from '../src/activities/types';
import {
  ACTIVITY_REGISTRY,
  answerSchemaFor,
  defaultSkillForType,
  defaultStageForType,
  offlineGradableTypes,
  promptSchemaFor,
} from '../src/activities/registry';
import { SKILLS } from '../src/skills/skills';
import { evaluateAnswer, defaultContext } from '../src/evaluation/evaluate';

describe('activity registry', () => {
  it('covers all 26 activity types from the specification', () => {
    expect(ACTIVITY_TYPES).toHaveLength(26);
    for (const type of ACTIVITY_TYPES) {
      expect(ACTIVITY_REGISTRY[type]).toBeDefined();
      expect(ACTIVITY_REGISTRY[type].type).toBe(type);
    }
  });

  it('gives every type a prompt schema and an answer schema', () => {
    for (const type of ACTIVITY_TYPES) {
      expect(promptSchemaFor(type)).toBeDefined();
      expect(answerSchemaFor(type)).toBeDefined();
    }
  });

  it('assigns every type a real skill and a valid lesson stage', () => {
    for (const type of ACTIVITY_TYPES) {
      expect(SKILLS).toContain(defaultSkillForType(type));
      expect(LESSON_STAGES).toContain(defaultStageForType(type));
    }
  });

  it('keeps AI grading to genuinely open production only', () => {
    const aiTypes = ACTIVITY_TYPES.filter((t) => ACTIVITY_REGISTRY[t].evaluation === 'ai');
    expect(aiTypes.sort()).toEqual(
      ['conversation', 'roleplay', 'scenario_simulation', 'speech_response', 'written_response'].sort(),
    );
  });

  it('can grade most activity types offline', () => {
    const offline = offlineGradableTypes();
    expect(offline.length).toBe(ACTIVITY_TYPES.length - 5);
    expect(offline).toContain('fill_blank');
    expect(offline).not.toContain('conversation');
  });

  it('marks the types that need audio or a speech recogniser', () => {
    expect(ACTIVITY_REGISTRY.listening_comprehension.requiresAudio).toBe(true);
    expect(ACTIVITY_REGISTRY.pronunciation_repeat.requiresSpeech).toBe(true);
    expect(ACTIVITY_REGISTRY.multiple_choice.requiresSpeech).toBe(false);
  });

  it('validates a well-formed activity and rejects a malformed one', () => {
    const valid = activitySchema.safeParse({
      id: 'a',
      type: 'multiple_choice',
      ordinal: 0,
      stage: 'practice',
      skill: 'grammar',
      cefr: 'A1',
      difficulty: 2,
      prompt: { question: 'q', options: [] },
    });
    expect(valid.success).toBe(true);

    const invalid = activitySchema.safeParse({
      id: 'a',
      type: 'not_a_type',
      ordinal: 0,
      stage: 'practice',
      skill: 'grammar',
      cefr: 'A1',
      difficulty: 2,
      prompt: {},
    });
    expect(invalid.success).toBe(false);
  });

  it('rejects an out-of-range difficulty', () => {
    const result = activitySchema.safeParse({
      id: 'a',
      type: 'multiple_choice',
      ordinal: 0,
      stage: 'practice',
      skill: 'grammar',
      cefr: 'A1',
      difficulty: 9,
      prompt: {},
    });
    expect(result.success).toBe(false);
  });

  it('never crashes grading an activity of any type with an empty answer', () => {
    for (const type of ACTIVITY_TYPES) {
      const activity = activitySchema.parse({
        id: `a-${type}`,
        type,
        ordinal: 0,
        stage: defaultStageForType(type),
        skill: defaultSkillForType(type),
        cefr: 'A1',
        difficulty: 1,
        prompt: {},
      });
      const verdict = evaluateAnswer(activity, {}, defaultContext('es', 'A1'));
      expect(verdict.correct).toBe(false);
      expect(verdict.score).toBe(0);
    }
  });
});
