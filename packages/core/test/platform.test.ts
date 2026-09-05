import { describe, expect, it } from 'vitest';
import { BRAND, brandInterpolation, storageKey } from '../src/brand/brand.config';
import { FORBIDDEN_PROP_KEYS, assertNoPii } from '../src/analytics/events';
import { DEFAULT_REMOTE_CONFIG, featureEnabled, parseRemoteConfig } from '../src/config/remoteConfig';
import { appError, errorFromStatus } from '../src/utils/result';
import { immersionAllowed, shouldShowInTargetLanguage, suggestedImmersion } from '../src/utils/immersion';
import { referralCode, uuid } from '../src/utils/id';

describe('brand indirection', () => {
  it('namespaces storage keys so a rename does not orphan data', () => {
    expect(storageKey('session')).toBe(`${BRAND.storagePrefix}:session`);
  });

  it('exposes the brand for i18n interpolation instead of hardcoded strings', () => {
    expect(brandInterpolation()['brandName']).toBe(BRAND.name);
    expect(brandInterpolation()['brandTagline']).toBe(BRAND.tagline);
  });
});

describe('analytics privacy', () => {
  it('rejects payloads carrying personal data', () => {
    for (const key of FORBIDDEN_PROP_KEYS) {
      expect(() => assertNoPii({ [key]: 'x' })).toThrow();
    }
  });

  it('accepts a clean payload', () => {
    expect(() => assertNoPii({ lessonId: 'l1', accuracy: 0.9 })).not.toThrow();
  });
});

describe('remote config', () => {
  it('accepts a valid payload', () => {
    const { config, usedFallback } = parseRemoteConfig({ ...DEFAULT_REMOTE_CONFIG, version: 4 });
    expect(usedFallback).toBe(false);
    expect(config.version).toBe(4);
  });

  it('falls back to compiled defaults when the payload is malformed', () => {
    const { config, usedFallback } = parseRemoteConfig({ commissionTiers: 'nonsense' });
    expect(usedFallback).toBe(true);
    expect(config.commissionTiers[0]?.bps).toBe(2500);
  });

  it('falls back rather than accepting an impossible commission rate', () => {
    const { usedFallback } = parseRemoteConfig({
      ...DEFAULT_REMOTE_CONFIG,
      commissionTiers: [{ minLessons: 0, maxLessons: null, bps: 50_000 }],
    });
    expect(usedFallback).toBe(true);
  });

  it('reads feature flags with a default', () => {
    expect(featureEnabled(DEFAULT_REMOTE_CONFIG, 'community')).toBe(true);
    expect(featureEnabled(DEFAULT_REMOTE_CONFIG, 'unknown_flag')).toBe(false);
  });
});

describe('error mapping', () => {
  it('maps HTTP statuses to actionable domain errors', () => {
    expect(errorFromStatus(401).code).toBe('unauthorized');
    expect(errorFromStatus(429).retryable).toBe(true);
    expect(errorFromStatus(403).retryable).toBe(false);
  });

  it('prefers an explicit code from the server', () => {
    expect(errorFromStatus(503, { code: 'ai_not_configured' }).code).toBe('ai_not_configured');
  });

  it('gives every error an i18n key', () => {
    expect(appError('slot_unavailable').messageKey).toBe('error.slot_unavailable');
  });
});

describe('immersion mode', () => {
  it('is deterministic per key so the UI does not flicker between languages', () => {
    const first = shouldShowInTargetLanguage('learn.continue', 50);
    for (let i = 0; i < 20; i++) {
      expect(shouldShowInTargetLanguage('learn.continue', 50)).toBe(first);
    }
  });

  it('honours the extremes', () => {
    expect(shouldShowInTargetLanguage('anything', 0)).toBe(false);
    expect(shouldShowInTargetLanguage('anything', 100)).toBe(true);
  });

  it('roughly matches the requested proportion', () => {
    const keys = Array.from({ length: 1000 }, (_, i) => `key.${i}`);
    const shown = keys.filter((k) => shouldShowInTargetLanguage(k, 50)).length;
    expect(shown).toBeGreaterThan(400);
    expect(shown).toBeLessThan(600);
  });

  it('keeps costly-to-misunderstand areas in the learner’s own language', () => {
    expect(immersionAllowed('payment.confirm')).toBe(false);
    expect(immersionAllowed('error.network')).toBe(false);
    expect(immersionAllowed('lesson.continue')).toBe(true);
  });

  it('suggests more immersion as ability grows', () => {
    expect(suggestedImmersion(0)).toBe(0);
    expect(suggestedImmersion(30)).toBe(50);
    expect(suggestedImmersion(60)).toBe(100);
  });
});

describe('identifiers', () => {
  it('mints unique attempt ids for idempotent offline sync', () => {
    const ids = new Set(Array.from({ length: 500 }, () => uuid()));
    expect(ids.size).toBe(500);
    expect([...ids][0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('mints referral codes from an unambiguous alphabet', () => {
    const code = referralCode(8);
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[23456789BCDFGHJKLMNPQRSTVWXYZ]+$/);
  });
});
