import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLACEMENT_CONFIG,
  advancePlacement,
  estimatePlacement,
  selectNextItem,
  startPlacement,
  type PlacementItem,
  type PlacementResponse,
} from '../src/adaptive/placement';
import { recommendNext, suggestTeacherFocus, type MistakeSignal } from '../src/adaptive/recommend';
import { estimateProfile, type SkillEvidence } from '../src/skills/estimate';

const NOW = Date.UTC(2026, 3, 1);

function response(cefr: PlacementResponse['cefr'], correct: boolean, skill: PlacementResponse['skill'] = 'reading'): PlacementResponse {
  return { itemId: `${cefr}-${skill}-${Math.random()}`, cefr, skill, correct };
}

describe('adaptive placement', () => {
  it('starts where the learner says they are', () => {
    expect(startPlacement('never').currentLevel).toBe('PRE_A1');
    expect(startPlacement('confident').currentLevel).toBe('B1');
  });

  it('steps up after consecutive successes', () => {
    let state = startPlacement('a_little');
    for (let i = 0; i < 3; i++) state = advancePlacement(state, response('A1', true));
    expect(state.currentLevel).toBe('A2');
  });

  it('steps down after consecutive failures', () => {
    let state = startPlacement('some');
    state = advancePlacement(state, response('A2', false));
    state = advancePlacement(state, response('A2', false));
    expect(state.currentLevel).toBe('A1');
  });

  it('never runs shorter than the minimum item count', () => {
    let state = startPlacement('some');
    for (let i = 0; i < DEFAULT_PLACEMENT_CONFIG.minItems - 1; i++) {
      state = advancePlacement(state, response('A2', i % 2 === 0));
    }
    expect(state.finished).toBe(false);
  });

  it('stops at the maximum item count', () => {
    let state = startPlacement('some');
    for (let i = 0; i < DEFAULT_PLACEMENT_CONFIG.maxItems; i++) {
      state = advancePlacement(state, response('A2', i % 3 === 0));
    }
    expect(state.finished).toBe(true);
  });

  it('refuses to name a level from five questions', () => {
    const result = estimatePlacement([
      response('B1', true),
      response('B1', true),
      response('B1', true),
      response('B1', true),
      response('B1', true),
    ]);
    expect(result.confidence).toBeLessThan(0.7);
    // Low confidence places the learner a step below the estimate.
    expect(result.recommendedStart).not.toBe('B1');
  });

  it('estimates a level and a range from a full ladder walk', () => {
    const responses: PlacementResponse[] = [
      ...Array.from({ length: 4 }, () => response('A1', true, 'reading')),
      ...Array.from({ length: 4 }, () => response('A2', true, 'listening')),
      ...Array.from({ length: 4 }, () => response('B1', true, 'grammar')),
      ...Array.from({ length: 4 }, () => response('B2', false, 'reading')),
    ];
    const result = estimatePlacement(responses);
    expect(result.estimated).toBe('B1');
    expect(result.range.high).toBe('B2');
    expect(result.itemsAnswered).toBe(16);
  });

  it('reports per-skill estimates and flags what it could not assess', () => {
    const responses: PlacementResponse[] = [
      ...Array.from({ length: 4 }, () => response('A2', true, 'reading')),
      ...Array.from({ length: 4 }, () => response('A1', true, 'listening')),
      ...Array.from({ length: 4 }, () => response('A2', false, 'listening')),
    ];
    const result = estimatePlacement(responses);
    expect(result.bySkill.reading).toBe('A2');
    expect(result.bySkill.listening).toBe('A1');
    expect(result.unassessedSkills).toContain('speaking');
  });

  it('places a complete beginner at Pre-A1', () => {
    const responses = Array.from({ length: 12 }, () => response('A1', false));
    expect(estimatePlacement(responses).estimated).toBe('PRE_A1');
  });

  it('picks unseen items at the current level, balancing skills', () => {
    const pool: PlacementItem[] = [
      { id: 'r1', cefr: 'A2', skill: 'reading', discrimination: 0.9 },
      { id: 'l1', cefr: 'A2', skill: 'listening', discrimination: 0.5 },
      { id: 'r2', cefr: 'B1', skill: 'reading', discrimination: 0.9 },
    ];
    let state = startPlacement('some');
    state = advancePlacement(state, { itemId: 'r1', cefr: 'A2', skill: 'reading', correct: true });
    const next = selectNextItem(state, pool);
    expect(next?.id).toBe('l1'); // listening is under-sampled
  });

  it('returns null when the pool is exhausted', () => {
    const pool: PlacementItem[] = [{ id: 'r1', cefr: 'A2', skill: 'reading', discrimination: 0.9 }];
    let state = startPlacement('some');
    state = advancePlacement(state, { itemId: 'r1', cefr: 'A2', skill: 'reading', correct: true });
    expect(selectNextItem(state, pool)).toBeNull();
  });
});

describe('recommendations', () => {
  const evidence: SkillEvidence[] = [
    ...Array.from({ length: 10 }, () => ({ skill: 'reading' as const, cefr: 'B1' as const, score: 0.9, source: 'lesson' as const, at: NOW - 86_400_000 })),
    ...Array.from({ length: 10 }, () => ({ skill: 'speaking' as const, cefr: 'A2' as const, score: 0.8, source: 'lesson' as const, at: NOW - 86_400_000 })),
  ];
  const profile = estimateProfile(evidence, { now: NOW });

  const mistakes: MistakeSignal[] = [
    { tag: 'grammar:es-preterite', skill: 'grammar', count: 6, lastSeenAt: NOW - 86_400_000, label: 'the preterite tense', target: { kind: 'grammar', id: 'es-preterite' } },
    { tag: 'vocab:restaurante', skill: 'vocabulary', count: 3, lastSeenAt: NOW - 2 * 86_400_000, label: 'restaurant vocabulary' },
  ];

  const base = {
    profile,
    mistakes,
    dueVocabularyCount: 12,
    leechCount: 0,
    daysSinceLastPractice: 1,
    minutesRemainingToday: 10,
    cefr: 'A2' as const,
    now: NOW,
  };

  it('puts a teacher’s assignment above anything the algorithm chose', () => {
    const recs = recommendNext({
      ...base,
      teacherAssignments: [{ id: 'as1', kind: 'speaking', title: 'Restaurant role-play', teacherName: 'Ana' }],
    });
    expect(recs[0]?.id).toBe('assignment:as1');
    expect(recs[0]?.reasonParams['teacher']).toBe('Ana');
  });

  it('prioritises overdue review over new lessons', () => {
    const recs = recommendNext({
      ...base,
      nextLesson: { id: 'l9', title: 'Ordering food', objective: 'Order a meal', minutes: 8 },
    });
    const reviewIndex = recs.findIndex((r) => r.id === 'review:due');
    const lessonIndex = recs.findIndex((r) => r.targetId === 'l9');
    expect(reviewIndex).toBeGreaterThanOrEqual(0);
    expect(reviewIndex).toBeLessThan(lessonIndex);
  });

  it('always explains why something is being recommended', () => {
    for (const rec of recommendNext(base)) {
      expect(rec.reasonKey).toBeTruthy();
    }
  });

  it('surfaces repeated recent mistakes with the topic named', () => {
    const recs = recommendNext(base);
    const mistakeRec = recs.find((r) => r.id === 'mistake:grammar:es-preterite');
    expect(mistakeRec).toBeDefined();
    expect(mistakeRec?.reasonParams['count']).toBe(6);
  });

  it('ignores stale mistakes', () => {
    const recs = recommendNext({
      ...base,
      mistakes: [{ ...mistakes[0]!, lastSeenAt: NOW - 90 * 86_400_000 }],
    });
    expect(recs.find((r) => r.id.startsWith('mistake:'))).toBeUndefined();
  });

  it('offers a short comeback session after an absence', () => {
    const recs = recommendNext({ ...base, daysSinceLastPractice: 5 });
    expect(recs.find((r) => r.id === 'quick:comeback')).toBeDefined();
  });

  it('targets the lagging skill', () => {
    const recs = recommendNext(base);
    expect(recs.find((r) => r.skill === 'speaking')).toBeDefined();
  });

  it('surfaces leeches for re-teaching rather than endless drilling', () => {
    const recs = recommendNext({ ...base, leechCount: 4 });
    const leech = recs.find((r) => r.id === 'review:leeches');
    expect(leech).toBeDefined();
    expect(leech?.reasonParams['count']).toBe(4);
  });

  it('does not recommend the same target twice', () => {
    const recs = recommendNext(base);
    const keys = recs.map((r) => `${r.kind}:${r.targetId ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('teacher focus suggestions', () => {
  it('turns the learner’s mistake profile into a lesson plan', () => {
    const evidence: SkillEvidence[] = Array.from({ length: 10 }, () => ({
      skill: 'writing' as const,
      cefr: 'A2' as const,
      score: 0.8,
      source: 'lesson' as const,
      at: NOW - 86_400_000,
    }));
    const focus = suggestTeacherFocus({
      profile: estimateProfile(evidence, { now: NOW }),
      mistakes: [
        { tag: 'grammar:es-preterite', skill: 'grammar', count: 8, lastSeenAt: NOW - 86_400_000, label: 'the preterite tense' },
        { tag: 'skill:listening', skill: 'listening', count: 4, lastSeenAt: NOW - 3 * 86_400_000, label: 'fast speech' },
      ],
      dueVocabularyCount: 45,
      now: NOW,
    });
    expect(focus[0]?.area).toBe('the preterite tense');
    expect(focus[0]?.evidence).toContain('8');
    expect(focus.some((f) => f.area === 'Vocabulary backlog')).toBe(true);
  });
});
