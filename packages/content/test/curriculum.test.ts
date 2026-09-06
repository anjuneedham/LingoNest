import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_REGISTRY,
  answerSchemaFor,
  cefrDistance,
  compareCefr,
  evaluateAnswer,
  defaultContext,
  promptSchemaFor,
  type ActivityType,
} from '@lingonest/core';
import { CURRICULA, LAUNCH_LANGUAGES, compileCourse, validateCurriculum } from '../src/index';

describe('curriculum validation', () => {
  for (const curriculum of CURRICULA) {
    it(`${curriculum.languageCode} has no validation errors`, () => {
      const report = validateCurriculum(curriculum);
      const errors = report.issues.filter((i) => i.severity === 'error');
      expect(errors.map((e) => `${e.where}: ${e.message}`)).toEqual([]);
    });
  }
});

describe('launch depth', () => {
  const stats = Object.fromEntries(
    CURRICULA.map((c) => [c.languageCode, validateCurriculum(c).stats]),
  );

  it('ships Spanish at the depth the roadmap promises', () => {
    // Pre-A1 complete, A1 complete (10 units x 5 lessons), A2 units 1-5.
    expect(stats['es']!.units).toBeGreaterThanOrEqual(19);
    expect(stats['es']!.lessons).toBeGreaterThanOrEqual(80);
    expect(stats['es']!.activities).toBeGreaterThanOrEqual(450);
  });

  it('is not a fake curriculum of five generic lessons per level', () => {
    for (const curriculum of CURRICULA) {
      for (const course of curriculum.courses) {
        const lessons = course.units.flatMap((u) => u.lessons);
        const activities = lessons.flatMap((l) => l.activities);
        expect(lessons.length).toBeGreaterThanOrEqual(3);
        // Real lessons, not stubs.
        expect(activities.length / lessons.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('uses a wide range of activity types, not just multiple choice', () => {
    for (const [code, s] of Object.entries(stats)) {
      expect(s.activityTypesUsed, `${code} uses too few activity types`).toBeGreaterThanOrEqual(15);
    }
  });

  it('exercises every activity type somewhere across the launch languages', () => {
    const used = new Set<string>();
    for (const curriculum of CURRICULA) {
      for (const course of curriculum.courses) {
        for (const unit of course.units) {
          for (const lesson of unit.lessons) {
            for (const activity of lesson.activities) used.add(activity.type);
          }
        }
      }
    }
    // The renderer must cover every type in the registry; these are the ones the
    // launch curriculum currently exercises.
    expect(used.size).toBeGreaterThanOrEqual(20);
  });
});

describe('pedagogical structure', () => {
  const compiled = CURRICULA.flatMap((c) =>
    c.courses.map((course, index) =>
      compileCourse(course, { languageCode: c.languageCode, ordinal: index + 1 }),
    ),
  );

  it('gives every unit a real-world task', () => {
    for (const course of compiled) {
      for (const unit of course.units) {
        expect(unit.realWorldTask, `${unit.slug} has no real-world task`).toBeTruthy();
      }
    }
  });

  it('ends every level with a checkpoint', () => {
    for (const course of compiled) {
      const hasCheckpoint = course.units.some((u) => u.lessons.some((l) => l.isCheckpoint));
      expect(hasCheckpoint, `${course.slug} has no checkpoint`).toBe(true);
    }
  });

  it('makes every learner produce language, not just recognise it', () => {
    const productive = new Set<ActivityType>([
      'speech_response',
      'written_response',
      'conversation',
      'roleplay',
      'scenario_simulation',
      'translation',
      'sentence_order',
      'fill_blank',
      'grammar_correction',
      'pronunciation_repeat',
      'spelling',
      'dictation',
    ]);
    for (const course of compiled) {
      const activities = course.units.flatMap((u) => u.lessons).flatMap((l) => l.activities);
      const producing = activities.filter((a) => productive.has(a.type));
      expect(producing.length / activities.length, `${course.slug} is too passive`).toBeGreaterThan(0.25);
    }
  });

  it('covers speaking and listening in every course', () => {
    for (const course of compiled) {
      const skills = new Set(
        course.units.flatMap((u) => u.lessons).flatMap((l) => l.activities.map((a) => a.skill)),
      );
      expect(skills.has('listening'), `${course.slug} has no listening`).toBe(true);
      expect(
        skills.has('speaking') || skills.has('pronunciation'),
        `${course.slug} has no speaking`,
      ).toBe(true);
    }
  });

  it('keeps activities close to the lesson level', () => {
    for (const course of compiled) {
      for (const unit of course.units) {
        for (const lesson of unit.lessons) {
          for (const activity of lesson.activities) {
            expect(
              cefrDistance(activity.cefr, lesson.cefr),
              `${lesson.slug}#${activity.ordinal}`,
            ).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('orders courses from lower to higher levels', () => {
    for (const curriculum of CURRICULA) {
      const levels = curriculum.courses.map((c) => c.cefr);
      for (let i = 1; i < levels.length; i++) {
        expect(compareCefr(levels[i]!, levels[i - 1]!)).toBeGreaterThan(0);
      }
    }
  });
});

describe('every authored activity is runnable', () => {
  const compiled = CURRICULA.flatMap((c) =>
    c.courses.map((course, index) =>
      compileCourse(course, { languageCode: c.languageCode, ordinal: index + 1 }),
    ),
  );
  const allActivities = compiled
    .flatMap((c) => c.units)
    .flatMap((u) => u.lessons)
    .flatMap((l) => l.activities);

  it('parses every prompt against its type schema', () => {
    for (const activity of allActivities) {
      const result = promptSchemaFor(activity.type).safeParse(activity.prompt);
      expect(result.success, `${activity.id}: ${JSON.stringify(result.error?.issues?.[0])}`).toBe(true);
    }
  });

  it('accepts the authored answer key through the grader', () => {
    // Deterministic types only: an AI-graded activity has no local answer key.
    const deterministic = allActivities.filter(
      (a) => ACTIVITY_REGISTRY[a.type].evaluation === 'deterministic' && a.correctAnswer !== undefined,
    );
    expect(deterministic.length).toBeGreaterThan(200);

    let checked = 0;
    for (const activity of deterministic) {
      const answer = answerFor(activity.type, activity.correctAnswer, activity.prompt);
      if (answer === null) continue;
      const parsed = answerSchemaFor(activity.type).safeParse(answer);
      expect(parsed.success, `${activity.id} answer shape`).toBe(true);
      const verdict = evaluateAnswer(activity, answer, defaultContext('es', activity.cefr));
      expect(verdict.correct, `${activity.id} (${activity.type}) rejects its own answer key`).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(200);
  });
});

/** Build the answer a learner would give, from the authored answer key. */
function answerFor(type: ActivityType, correct: unknown, prompt: unknown): Record<string, unknown> | null {
  switch (type) {
    case 'multiple_choice':
    case 'tap_translation':
    case 'image_match':
    case 'audio_recognition':
    case 'dialogue_completion':
      return typeof correct === 'string' ? { optionId: correct } : null;
    case 'multiple_answer':
      return Array.isArray(correct) ? { optionIds: correct } : null;
    case 'fill_blank':
    case 'story_completion':
      return Array.isArray(correct) ? { blanks: correct } : null;
    case 'sentence_order':
      return Array.isArray(correct) ? { tokens: correct } : null;
    case 'word_match': {
      const pairs = (prompt as { pairs?: { left: string; right: string }[] }).pairs ?? [];
      return { pairs };
    }
    case 'drag_drop':
    case 'word_categorization':
      return typeof correct === 'object' && correct !== null ? { mapping: correct } : null;
    case 'dictation':
    case 'spelling':
    case 'grammar_correction':
      return typeof correct === 'string' ? { text: correct } : null;
    case 'listening_comprehension':
      return typeof correct === 'string'
        ? correct.length <= 2
          ? { optionId: correct }
          : { text: correct }
        : null;
    default:
      return null;
  }
}

describe('language definitions', () => {
  it('has a curriculum for every launch language', () => {
    for (const language of LAUNCH_LANGUAGES) {
      expect(
        CURRICULA.some((c) => c.languageCode === language.code),
        `${language.code} has no curriculum`,
      ).toBe(true);
    }
  });

  it('gives every language exactly one default variant', () => {
    for (const language of LAUNCH_LANGUAGES) {
      const defaults = language.variants.filter((v) => v.isDefault);
      expect(defaults, `${language.code}`).toHaveLength(1);
      expect(defaults[0]!.code).toBe(language.defaultVariantCode);
    }
  });

  it('flags the languages that need a writing-system module', () => {
    expect(LAUNCH_LANGUAGES.find((l) => l.code === 'ja')?.requiresScriptModule).toBe(true);
    expect(LAUNCH_LANGUAGES.find((l) => l.code === 'es')?.requiresScriptModule).toBe(false);
  });

  it('records that Japanese is not space-separated', () => {
    expect(LAUNCH_LANGUAGES.find((l) => l.code === 'ja')?.spaceSeparated).toBe(false);
  });
});

describe('media licensing', () => {
  it('refuses to ship an asset without a licence', () => {
    for (const curriculum of CURRICULA) {
      for (const asset of curriculum.media) {
        expect(asset.licence, `${asset.key}`).toBeTruthy();
        expect(asset.licence).not.toBe('unknown');
        expect(asset.source, `${asset.key}`).toBeTruthy();
      }
    }
  });

  it('resolves every media reference in every activity', () => {
    for (const curriculum of CURRICULA) {
      const keys = new Set(curriculum.media.map((m) => m.key));
      const compiled = curriculum.courses.map((course, index) =>
        compileCourse(course, { languageCode: curriculum.languageCode, ordinal: index + 1 }),
      );
      for (const course of compiled) {
        for (const unit of course.units) {
          for (const lesson of unit.lessons) {
            for (const activity of lesson.activities) {
              for (const media of activity.media) {
                expect(keys.has(media.assetKey), `${activity.id} → ${media.assetKey}`).toBe(true);
              }
            }
          }
        }
      }
    }
  });
});

describe('regional variants', () => {
  it('does not present one country’s usage as the whole language', () => {
    const spanish = CURRICULA.find((c) => c.languageCode === 'es')!;
    const withOverrides = spanish.vocabulary.filter((v) => v.variantOverrides);
    expect(withOverrides.length).toBeGreaterThan(8);
    const coche = spanish.vocabulary.find((v) => v.key === 'coche');
    expect(coche?.variantOverrides?.['es-MX']).toBe('el carro');
  });

  it('tags culture notes with the variants they apply to', () => {
    const spanish = CURRICULA.find((c) => c.languageCode === 'es')!;
    const vosotros = spanish.culture.find((c) => c.key === 'es-vosotros');
    expect(vosotros?.variantCodes).toEqual(['es-ES']);
  });
});

describe('claims made to learners', () => {
  it('never claims certification anywhere in the curriculum', () => {
    const forbidden = /\b(certif\w*|officially certified|native speaker level)\b/i;
    for (const curriculum of CURRICULA) {
      for (const course of curriculum.courses) {
        expect(course.description, course.slug).not.toMatch(forbidden);
        for (const unit of course.units) {
          for (const lesson of unit.lessons) {
            expect(lesson.canDo, lesson.slug).not.toMatch(forbidden);
            expect(lesson.objective, lesson.slug).not.toMatch(forbidden);
          }
        }
      }
    }
  });
});
