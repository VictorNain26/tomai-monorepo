import { Mistral } from '@mistralai/mistralai';
import { HTTPClient } from '@mistralai/mistralai/lib/http.js';
import type { RetryConfig } from '@mistralai/mistralai/lib/retries.js';
import { env } from '../config/env.js';

/*
 * Retries of the SDK calls (@mistralai/mistralai 2.7.0, README « Retries » and « Custom HTTP
 * Client »). The SDK retries 429, 500, 502, 503 and 504, waits up to `maxInterval` between
 * attempts (a Retry-After past it is cut to it), and stops once `maxElapsedTime` has passed.
 * The call's timeout signal is shared by every attempt (`esm/lib/sdks.js`): a call past it
 * would be retried, failing at once, until the window closes. So a timeout is retried only
 * with a timeout of its own per attempt, and a window that closes before the call's timeout.
 */

/** Moderation: one attempt, its retries and its timeout, all under the call's budget. */
const MODERATION_ATTEMPT_MS = 1_500;
const MODERATION_RETRY_WINDOW_MS = 2_500;
export const MODERATION_TIMEOUT_MS = 5_000;

const backoff = (maxElapsedTime: number) => ({ initialInterval: 500, maxInterval: 1_000, exponent: 1.5, maxElapsedTime });

/** MISTRAL_RETRY_ATTEMPTS set to 0 stops the retries here as it does for the AI SDK calls. */
const retrying = () => env.MISTRAL_RETRY_ATTEMPTS > 0;

function create(retryConfig: RetryConfig, httpClient?: HTTPClient): Mistral {
  if (!env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY is required');
  return new Mistral({
    apiKey: env.MISTRAL_API_KEY,
    timeoutMs: env.MISTRAL_TIMEOUT,
    serverURL: env.MISTRAL_SERVER_URL,
    retryConfig,
    ...(httpClient && { httpClient }),
  });
}

let client: Mistral | null = null;
let moderationClient: Mistral | null = null;

/** Embeddings and voice: 429 and 5xx retried, not a timeout, their calls lasting up to MISTRAL_TIMEOUT. */
export function getMistralSdk(): Mistral {
  client ??= create(retrying()
    ? { strategy: 'backoff', backoff: backoff(3_000), retryConnectionErrors: false }
    : { strategy: 'none' });
  return client;
}

/**
 * Moderation, before every reply: a hung attempt is cut and retried too, the window closing
 * before the call's timeout. Measured during a Mistral incident (2026-10-05): 503s and calls
 * hung past 5 s, while the next calls answered in 150 to 420 ms.
 */
export function getModerationSdk(): Mistral {
  moderationClient ??= retrying()
    ? create({ strategy: 'backoff', backoff: backoff(MODERATION_RETRY_WINDOW_MS), retryConnectionErrors: true }, attemptTimeout(MODERATION_ATTEMPT_MS))
    : create({ strategy: 'none' });
  return moderationClient;
}

/** A timeout per attempt, beside the call's own (README, « Custom HTTP Client », beforeRequest). */
function attemptTimeout(ms: number): HTTPClient {
  const httpClient = new HTTPClient();
  httpClient.addHook('beforeRequest', (request) => new Request(request, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(ms)]) }));
  return httpClient;
}
