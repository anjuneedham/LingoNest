import { describe, expect, it } from 'vitest';
import {
  cefrDistance,
  cefrLadder,
  compareCefr,
  majorOf,
  nextCefr,
  parseCefr,
  previousCefr,
} from '../src/cefr/levels';
import { canDoSummary } from '../src/cefr/canDo';

describe('CEFR ladder', () => {
  it('orders levels from Pre-A1 to C2', () => {
    expect(compareCefr('PRE_A1', 'A1')).toBeLessThan(0);
    expect(compareCefr('B2', 'B1')).toBeGreaterThan(0);
    expect(compareCefr('C1', 'C1')).toBe(0);
  });

  it('places plus levels between their neighbours', () => {
    expect(compareCefr('A2', 'A2_PLUS')).toBeLessThan(0);
    expect(compareCefr('A2_PLUS', 'B1')).toBeLessThan(0);
  });

  it('excludes plus levels unless the language enables them', () => {
    expect(cefrLadder()).toEqual(['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    expect(cefrLadder({ plusLevels: ['A2_PLUS'] })).toEqual([
      'PRE_A1',
      'A1',
      'A2',
      'A2_PLUS',
      'B1',
      'B2',
      'C1',
      'C2',
    ]);
  });

  it('respects a language ceiling', () => {
    expect(cefrLadder({ highest: 'B1' })).toEqual(['PRE_A1', 'A1', 'A2', 'B1']);
  });

  it('steps to the next configured level', () => {
    expect(nextCefr('A2')).toBe('B1');
    expect(nextCefr('A2', { plusLevels: ['A2_PLUS'] })).toBe('A2_PLUS');
    expect(nextCefr('C2')).toBeNull();
    expect(previousCefr('PRE_A1')).toBeNull();
  });

  it('falls forward when the current level is a disabled plus band', () => {
    expect(nextCefr('A2_PLUS')).toBe('B1');
  });

  it('maps plus bands to their major band', () => {
    expect(majorOf('B1_PLUS')).toBe('B1');
    expect(majorOf('C1')).toBe('C1');
  });

  it('measures distance in ladder steps', () => {
    expect(cefrDistance('A1', 'B1')).toBe(2);
    expect(cefrDistance('B2', 'B2')).toBe(0);
  });

  it('parses human-written level strings', () => {
    expect(parseCefr('a2')).toBe('A2');
    expect(parseCefr('Pre-A1')).toBe('PRE_A1');
    expect(parseCefr('B1+')).toBe('B1_PLUS');
    expect(parseCefr('D9')).toBeNull();
  });

  it('has a plain-language summary for every level', () => {
    for (const level of cefrLadder({ plusLevels: ['A2_PLUS', 'B1_PLUS', 'B2_PLUS'] })) {
      expect(canDoSummary(level).length).toBeGreaterThan(10);
    }
  });

  it('never describes any level as certification or native', () => {
    for (const level of cefrLadder({ plusLevels: ['A2_PLUS', 'B1_PLUS', 'B2_PLUS'] })) {
      const text = canDoSummary(level).toLowerCase();
      expect(text).not.toContain('certif');
      expect(text).not.toContain('native speaker');
    }
  });
});
