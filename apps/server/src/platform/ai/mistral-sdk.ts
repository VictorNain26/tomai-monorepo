import { Mistral } from '@mistralai/mistralai';
import { env } from '../config/env.js';

let client: Mistral | null = null;

export function getMistralSdk(): Mistral {
  if (!env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY is required');
  client ??= new Mistral({
    apiKey: env.MISTRAL_API_KEY,
    timeoutMs: env.MISTRAL_TIMEOUT,
    serverURL: env.MISTRAL_SERVER_URL,
    // 429 and 5xx retried, as the calls through the AI SDK are (README, « Retries »). Not the
    // timeouts: every attempt shares the call's timeout signal (@mistralai/mistralai 2.7.0,
    // `esm/lib/sdks.js`), so a timed-out call would be retried, failing at once, until
    // maxElapsedTime.
    retryConfig: {
      strategy: 'backoff',
      backoff: { initialInterval: 250, maxInterval: 1_000, exponent: 1.5, maxElapsedTime: 3_000 },
      retryConnectionErrors: false,
    },
  });
  return client;
}
