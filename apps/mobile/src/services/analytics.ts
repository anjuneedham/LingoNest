import { Platform } from 'react-native';
import type { AnalyticsEvent, AnalyticsEventName, PropsOf } from '@lingonest/core';
import { assertNoPii, uuid } from '@lingonest/core';
import { callFunction } from './api';

/**
 * Analytics buffer.
 *
 * Events are typed by the union in @lingonest/core, so a typo is a compile
 * error. They batch and survive going offline, and `assertNoPii` fails loudly
 * in development if a payload ever carries something it should not.
 */

const FLUSH_INTERVAL_MS = 20_000;
const MAX_BUFFER = 100;

interface BufferedEvent {
  readonly name: AnalyticsEventName;
  readonly props: Record<string, unknown>;
  readonly ts: number;
  readonly sessionId: string;
}

const sessionId = uuid();
let buffer: BufferedEvent[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

export function track<N extends AnalyticsEventName>(name: N, props: PropsOf<N>): void {
  const payload = props as Record<string, unknown>;

  if (__DEV__) {
    // Fail loudly in development rather than quietly shipping personal data.
    assertNoPii(payload);
  }

  buffer.push({ name, props: payload, ts: Date.now(), sessionId });
  if (buffer.length >= MAX_BUFFER) void flush();
}

/** Typed helper so callers can build an event object and pass it whole. */
export function trackEvent(event: AnalyticsEvent): void {
  track(event.name, event.props as never);
}

export async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];

  const result = await callFunction('analytics-ingest', {
    events: batch,
    appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? '0.1.0',
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  });

  // Keep the events for the next attempt if the network failed, but drop them
  // if the server rejected them — retrying a rejected payload never succeeds.
  if (!result.ok && result.error.retryable) {
    buffer = [...batch, ...buffer].slice(-MAX_BUFFER);
  }
}

export function startAnalytics(): () => void {
  if (timer) clearInterval(timer);
  timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    void flush();
  };
}
