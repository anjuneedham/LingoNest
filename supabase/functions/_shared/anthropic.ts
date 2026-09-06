import { config, isAiConfigured } from './env.ts';
import { log } from './http.ts';

/**
 * Anthropic client.
 *
 * The API key exists only here. The client sends intent and its own text; the
 * system prompt is always assembled server-side from database facts, so a
 * modified client cannot rewrite the tutor's instructions.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface Message {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface CompletionRequest {
  readonly system: string;
  readonly messages: readonly Message[];
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly model?: string;
  /** Forces JSON output by pre-filling the assistant turn with an opening brace. */
  readonly expectJson?: boolean;
}

export interface CompletionResult {
  readonly text: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly model: string;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not configured');
  }
}

export class AiUnavailableError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function complete(request: CompletionRequest): Promise<CompletionResult> {
  if (!isAiConfigured()) throw new AiNotConfiguredError();

  const model = request.model ?? config.anthropicModel();
  const messages = request.expectJson
    ? [...request.messages, { role: 'assistant' as const, content: '{' }]
    : [...request.messages];

  const started = Date.now();
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicKey()!,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.7,
      system: request.system,
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    log('ai_error', { status: response.status, model });
    throw new AiUnavailableError(response.status, detail.slice(0, 200));
  }

  const payload = await response.json();
  const text: string = (payload.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('');

  log('ai_completion', {
    model,
    ms: Date.now() - started,
    inputTokens: payload.usage?.input_tokens ?? 0,
    outputTokens: payload.usage?.output_tokens ?? 0,
  });

  return {
    // Re-attach the brace we used to force JSON output.
    text: request.expectJson ? `{${text}` : text,
    inputTokens: payload.usage?.input_tokens ?? 0,
    outputTokens: payload.usage?.output_tokens ?? 0,
    model,
  };
}

/** Anthropic's published price per million tokens, in micros of a US cent. */
const PRICE_MICROS_PER_TOKEN = { input: 3, output: 15 };

export function costMicros(result: CompletionResult): number {
  return result.inputTokens * PRICE_MICROS_PER_TOKEN.input + result.outputTokens * PRICE_MICROS_PER_TOKEN.output;
}

/**
 * Extract the first JSON object from a model response.
 * Models sometimes wrap JSON in prose or a code fence even when told not to.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no JSON object in response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
