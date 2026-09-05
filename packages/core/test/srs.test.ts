import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SRS_SETTINGS,
  buildReviewQueue,
  dueCount,
  gradeFromOutcome,
  newCard,
  reviewCard,
  reviewForecast,
  type SrsCard,
} from '../src/srs/scheduler';

const NOW = Date.UTC(2026, 2, 1, 12, 0, 0);
const MIN = 60_000;
const DAY = 86_400_000;

describe('SRS scheduling', () => {
  it('starts a new card due immediately', () => {
    const card = newCard(NOW);
    expect(card.state).toBe('new');
    expect(card.dueAt).toBe(NOW);
  });

  it('walks the learning steps before graduating', () => {
    let card = newCard(NOW);
    card = reviewCard(card, { grade: 'good', now: NOW });
    expect(card.state).toBe('learning');
    expect(card.dueAt).toBe(NOW + 10 * MIN);

    card = reviewCard(card, { grade: 'good', now: NOW });
    expect(card.dueAt).toBe(NOW + 60 * MIN);

    card = reviewCard(card, { grade: 'good', now: NOW });
    expect(card.dueAt).toBe(NOW + 1440 * MIN);

    card = reviewCard(card, { grade: 'good', now: NOW });
    expect(card.state).toBe('review');
    expect(card.intervalDays).toBe(DEFAULT_SRS_SETTINGS.graduatingIntervalDays);
  });

  it('does not schedule a word a week out after one correct answer', () => {
    const card = reviewCard(newCard(NOW), { grade: 'good', now: NOW });
    expect(card.dueAt - NOW).toBeLessThan(DAY);
  });

  it('graduates immediately on "easy"', () => {
    const card = reviewCard(newCard(NOW), { grade: 'easy', now: NOW });
    expect(card.state).toBe('review');
    expect(card.intervalDays).toBe(DEFAULT_SRS_SETTINGS.easyIntervalDays);
  });

  it('repeats the same step on "hard"', () => {
    let card = reviewCard(newCard(NOW), { grade: 'good', now: NOW }); // step 1
    const step = card.step;
    card = reviewCard(card, { grade: 'hard', now: NOW });
    expect(card.step).toBe(step);
  });

  it('expands the interval by the ease factor on review', () => {
    let card: SrsCard = {
      state: 'review',
      ease: 2.5,
      intervalDays: 10,
      repetitions: 3,
      lapses: 0,
      step: 0,
      dueAt: NOW,
      lastReviewedAt: NOW - DAY,
    };
    card = reviewCard(card, { grade: 'good', now: NOW });
    expect(card.intervalDays).toBeGreaterThan(20);
    expect(card.intervalDays).toBeLessThan(30);
  });

  it('shrinks the interval and ease on a lapse', () => {
    const graduated: SrsCard = {
      state: 'review',
      ease: 2.5,
      intervalDays: 30,
      repetitions: 5,
      lapses: 0,
      step: 0,
      dueAt: NOW,
      lastReviewedAt: NOW - DAY,
    };
    const lapsed = reviewCard(graduated, { grade: 'again', now: NOW });
    expect(lapsed.state).toBe('learning');
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.ease).toBeLessThan(2.5);
    expect(lapsed.dueAt).toBe(NOW + MIN);
  });

  it('flags a repeatedly forgotten word as a leech', () => {
    let card: SrsCard = { ...newCard(NOW), state: 'review', lapses: 5, intervalDays: 4, repetitions: 2 };
    card = reviewCard(card, { grade: 'again', now: NOW });
    expect(card.state).toBe('leech');
  });

  it('never lets the ease fall below the floor', () => {
    let card: SrsCard = { ...newCard(NOW), state: 'review', intervalDays: 5, ease: 1.35 };
    for (let i = 0; i < 5; i++) card = reviewCard(card, { grade: 'again', now: NOW });
    expect(card.ease).toBeGreaterThanOrEqual(DEFAULT_SRS_SETTINGS.minEase);
  });

  it('caps the interval', () => {
    const card: SrsCard = {
      state: 'review',
      ease: 2.8,
      intervalDays: 300,
      repetitions: 12,
      lapses: 0,
      step: 0,
      dueAt: NOW,
      lastReviewedAt: NOW,
    };
    const next = reviewCard(card, { grade: 'easy', now: NOW });
    expect(next.intervalDays).toBeLessThanOrEqual(DEFAULT_SRS_SETTINGS.maxIntervalDays);
  });

  it('marks long intervals as mastered', () => {
    const card: SrsCard = {
      state: 'review',
      ease: 2.5,
      intervalDays: 40,
      repetitions: 8,
      lapses: 0,
      step: 0,
      dueAt: NOW,
      lastReviewedAt: NOW,
    };
    expect(reviewCard(card, { grade: 'good', now: NOW }).state).toBe('mastered');
  });
});

describe('grade derivation', () => {
  it('turns an incorrect answer into "again"', () => {
    expect(gradeFromOutcome({ correct: false })).toBe('again');
  });

  it('downgrades a hinted answer to "hard"', () => {
    expect(gradeFromOutcome({ correct: true, hintsUsed: 1 })).toBe('hard');
  });

  it('rewards a fast answer with "easy"', () => {
    expect(gradeFromOutcome({ correct: true, responseMs: 1000, baselineMs: 4000 })).toBe('easy');
  });

  it('treats a slow answer as "hard"', () => {
    expect(gradeFromOutcome({ correct: true, responseMs: 9000, baselineMs: 4000 })).toBe('hard');
  });
});

describe('review queue', () => {
  const card = (overrides: Partial<SrsCard>): SrsCard => ({ ...newCard(NOW), ...overrides });

  it('leads with leeches, then learning, then reviews, then new cards', () => {
    const items = [
      { item: 'new', card: card({ state: 'new', dueAt: NOW }) },
      { item: 'review', card: card({ state: 'review', dueAt: NOW - DAY }) },
      { item: 'learning', card: card({ state: 'learning', dueAt: NOW - MIN }) },
      { item: 'leech', card: card({ state: 'leech', dueAt: NOW - 2 * DAY }) },
    ];
    const queue = buildReviewQueue(items, { limit: 10, newCardLimit: 5, now: NOW });
    expect(queue.map((q) => q.item)).toEqual(['leech', 'learning', 'review', 'new']);
  });

  it('caps new cards so a session is not all new material', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ item: i, card: card({ state: 'new' }) }));
    const queue = buildReviewQueue(items, { limit: 20, newCardLimit: 5, now: NOW });
    expect(queue).toHaveLength(5);
  });

  it('excludes cards that are not yet due', () => {
    const items = [
      { item: 'future', card: card({ state: 'review', dueAt: NOW + 5 * DAY }) },
      { item: 'due', card: card({ state: 'review', dueAt: NOW - MIN }) },
    ];
    expect(buildReviewQueue(items, { limit: 10, newCardLimit: 0, now: NOW }).map((q) => q.item)).toEqual(['due']);
  });

  it('counts and forecasts due cards', () => {
    const cards = [
      card({ dueAt: NOW - DAY }),
      card({ dueAt: NOW + DAY }),
      card({ dueAt: NOW + 2 * DAY }),
      card({ dueAt: NOW + 2 * DAY }),
    ];
    expect(dueCount(cards, NOW)).toBe(1);
    expect(reviewForecast(cards, 3, NOW)).toEqual([1, 1, 2]);
  });
});
