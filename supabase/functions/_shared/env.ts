/**
 * Secret access, in one place.
 *
 * Every third-party credential is read here and nowhere else. A missing key is
 * not an error at import time — the app must still work for everything that
 * does not need it — so each accessor reports "not configured" and the calling
 * function returns a specific error the UI knows how to render.
 */

export function optionalEnv(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new ConfigurationError(name);
  return value;
}

export class ConfigurationError extends Error {
  constructor(readonly variable: string) {
    super(`${variable} is not configured`);
    this.name = 'ConfigurationError';
  }
}

export const config = {
  supabaseUrl: () => requiredEnv('SUPABASE_URL'),
  supabaseAnonKey: () => requiredEnv('SUPABASE_ANON_KEY'),
  serviceRoleKey: () => requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),

  anthropicKey: () => optionalEnv('ANTHROPIC_API_KEY'),
  anthropicModel: () => optionalEnv('ANTHROPIC_MODEL') ?? 'claude-sonnet-5',

  stripeSecret: () => optionalEnv('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: () => optionalEnv('STRIPE_WEBHOOK_SECRET'),

  videoProvider: () => optionalEnv('VIDEO_PROVIDER') ?? 'none',
  dailyApiKey: () => optionalEnv('DAILY_API_KEY'),
};

export const isAiConfigured = () => Boolean(config.anthropicKey());
export const isPaymentsConfigured = () => Boolean(config.stripeSecret());
export const isVideoConfigured = () =>
  config.videoProvider() !== 'none' && Boolean(config.dailyApiKey());
