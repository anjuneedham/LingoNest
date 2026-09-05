/** A small Result type so services can return failures without throwing. */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Error codes the UI knows how to render. Every one maps to an i18n key and a
 * concrete next action — there are no silent failures (brief §89).
 */
export const ERROR_CODES = [
  'network_offline',
  'network_timeout',
  'unauthorized',
  'forbidden',
  'not_found',
  'rate_limited',
  'validation_failed',
  'conflict',
  'ai_not_configured',
  'ai_unavailable',
  'ai_limit_reached',
  'payments_not_configured',
  'payment_failed',
  'payout_account_incomplete',
  'subscription_required',
  'video_not_configured',
  'slot_unavailable',
  'booking_not_cancellable',
  'speech_unavailable',
  'content_unavailable',
  'unknown',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface AppError {
  readonly code: ErrorCode;
  /** i18n key for the message shown to the user. */
  readonly messageKey: string;
  /** Whether a retry could plausibly succeed. */
  readonly retryable: boolean;
  readonly detail?: string;
  readonly status?: number;
}

const RETRYABLE: ReadonlySet<ErrorCode> = new Set([
  'network_offline',
  'network_timeout',
  'rate_limited',
  'ai_unavailable',
  'unknown',
]);

export function appError(code: ErrorCode, detail?: string, status?: number): AppError {
  return {
    code,
    messageKey: `error.${code}`,
    retryable: RETRYABLE.has(code),
    detail,
    status,
  };
}

/** Map an HTTP status from an Edge Function into a domain error. */
export function errorFromStatus(status: number, body?: { code?: string; detail?: string }): AppError {
  const declared = body?.code;
  if (declared && (ERROR_CODES as readonly string[]).includes(declared)) {
    return appError(declared as ErrorCode, body?.detail, status);
  }
  if (status === 401) return appError('unauthorized', body?.detail, status);
  if (status === 403) return appError('forbidden', body?.detail, status);
  if (status === 404) return appError('not_found', body?.detail, status);
  if (status === 409) return appError('conflict', body?.detail, status);
  if (status === 422) return appError('validation_failed', body?.detail, status);
  if (status === 429) return appError('rate_limited', body?.detail, status);
  if (status === 503) return appError('ai_unavailable', body?.detail, status);
  return appError('unknown', body?.detail, status);
}
