import { appError, errorFromStatus, type AppError, type Result } from '@lingonest/core';
import { supabase, functionsUrl, isBackendConfigured } from './supabase';

/**
 * Calls an Edge Function.
 *
 * Returns a Result rather than throwing, because every caller has a screen
 * state to render for a failure and none of them should be a blank page.
 */
export async function callFunction<T>(
  name: string,
  body: unknown,
  options: { timeoutMs?: number } = {},
): Promise<Result<T, AppError>> {
  if (!isBackendConfigured) {
    return { ok: false, error: appError('unknown', 'the backend is not configured in this build') };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: appError('unauthorized') };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    const response = await fetch(functionsUrl(name), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-app-version': process.env.EXPO_PUBLIC_APP_VERSION ?? '0.1.0',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

    if (!response.ok) {
      return {
        ok: false,
        error: errorFromStatus(response.status, {
          code: payload.code as string | undefined,
          detail: payload.detail as string | undefined,
        }),
      };
    }

    return { ok: true, value: payload as T };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: appError('network_timeout') };
    }
    return { ok: false, error: appError('network_offline', String(error).slice(0, 120)) };
  } finally {
    clearTimeout(timeout);
  }
}

/** Wraps a PostgREST call in the same Result shape. */
export async function query<T>(
  run: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
): Promise<Result<T, AppError>> {
  try {
    const { data, error } = await run();
    if (error) {
      // PostgREST reports an RLS denial as an empty result or a 42501.
      if (error.code === '42501') return { ok: false, error: appError('forbidden', error.message) };
      return { ok: false, error: appError('unknown', error.message) };
    }
    if (data === null) return { ok: false, error: appError('not_found') };
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: appError('network_offline', String(error).slice(0, 120)) };
  }
}
