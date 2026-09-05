import { describe, expect, it } from 'vitest';
import {
  MIN_WEIGHT_FOR_ESTIMATE,
  estimateProfile,
  estimateSkillLevel,
  explainEstimate,
  laggingSkills,
  type SkillEvidence,
} from '../src/skills/estimate';

const NOW = Date.UTC(2026, 0, 15);
const day = (n: number) => NOW - n * 86_400_000;

function evidence(partial: Partial<SkillEvidence> & Pick<SkillEvidence, 'skill' | 'cefr' | 'score'>): SkillEvidence {
  return { source: 'activity', at: day(1), ...partial };
}

describe('skill estimation', () => {
  it('refuses to report a level from a single quiz', () => {
    const result = estimateSkillLevel('reading', [evidence({ skill: 'reading', cefr: 'B1', score: 1 })], { now: NOW });
    expect(result.level).toBeNull();
    expect(result.weight).toBeLessThan(MIN_WEIGHT_FOR_ESTIMATE);
  });

  it('reports a level once enough evidence accumulates', () => {
    const items: SkillEvidence[] = Array.from({ length: 10 }, () =>
      evidence({ skill: 'reading', cefr: 'A2', score: 0.9, source: 'lesson' }),
    );
    const result = estimateSkillLevel('reading', items, { now: NOW });
    expect(result.level).toBe('A2');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('does not credit a level the learner keeps failing', () => {
    const items: SkillEvidence[] = [
      ...Array.from({ length: 8 }, () => evidence({ skill: 'grammar', cefr: 'A1', score: 0.95, source: 'lesson' })),
      ...Array.from({ length: 6 }, () => evidence({ skill: 'grammar', cefr: 'B1', score: 0.2, source: 'lesson' })),
    ];
    const result = estimateSkillLevel('grammar', items, { now: NOW });
    expect(result.level).toBe('A1');
  });

  it('discounts stale evidence', () => {
    const stale: SkillEvidence[] = Array.from({ length: 10 }, () =>
      evidence({ skill: 'listening', cefr: 'B1', score: 1, source: 'lesson', at: day(400) }),
    );
    expect(estimateSkillLevel('listening', stale, { now: NOW }).level).toBeNull();
  });

  it('weights a checkpoint more heavily than a single activity', () => {
    const checkpoint = estimateSkillLevel(
      'writing',
      Array.from({ length: 2 }, () => evidence({ skill: 'writing', cefr: 'A2', score: 0.9, source: 'checkpoint' })),
      { now: NOW },
    );
    const activities = estimateSkillLevel(
      'writing',
      Array.from({ length: 2 }, () => evidence({ skill: 'writing', cefr: 'A2', score: 0.9, source: 'activity' })),
      { now: NOW },
    );
    expect(checkpoint.weight).toBeGreaterThan(activities.weight);
  });

  it('builds an uneven profile with a conservative overall estimate', () => {
    const items: SkillEvidence[] = [
      ...Array.from({ length: 10 }, () => evidence({ skill: 'reading', cefr: 'B2', score: 0.9, source: 'lesson' })),
      ...Array.from({ length: 10 }, () => evidence({ skill: 'listening', cefr: 'B1', score: 0.85, source: 'lesson' })),
      ...Array.from({ length: 10 }, () => evidence({ skill: 'speaking', cefr: 'B1', score: 0.8, source: 'lesson' })),
      ...Array.from({ length: 10 }, () => evidence({ skill: 'writing', cefr: 'A2', score: 0.85, source: 'lesson' })),
      ...Array.from({ length: 10 }, () => evidence({ skill: 'grammar', cefr: 'B1', score: 0.8, source: 'lesson' })),
      ...Array.from({ length: 10 }, () => evidence({ skill: 'vocabulary', cefr: 'B1', score: 0.85, source: 'lesson' })),
    ];
    const profile = estimateProfile(items, { now: NOW });
    expect(profile.bySkill.reading.level).toBe('B2');
    expect(profile.bySkill.writing.level).toBe('A2');
    // Overall never exceeds the strongest skill and is dragged down by the weakest.
    expect(profile.overall).toBe('B1');
    expect(laggingSkills(profile)).toContain('writing');
  });

  it('explains an estimate by source', () => {
    const items: SkillEvidence[] = [
      ...Array.from({ length: 6 }, () => evidence({ skill: 'reading', cefr: 'A2', score: 0.9, source: 'lesson' })),
      evidence({ skill: 'reading', cefr: 'A2', score: 0.8, source: 'checkpoint' }),
    ];
    const estimate = estimateSkillLevel('reading', items, { now: NOW });
    const explanation = explainEstimate(estimate, items, NOW);
    expect(explanation.map((e) => e.source)).toContain('lesson');
    expect(explanation.map((e) => e.source)).toContain('checkpoint');
  });
});
