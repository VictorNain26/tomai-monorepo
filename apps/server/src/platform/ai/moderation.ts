/**
 * Mistral's moderation (docs.mistral.ai/studio/safety-moderation), through its own SDK: the AI
 * SDK has none. `mistral-moderation-2603` is free (its model card) and served on the EU endpoint.
 * Each category comes with a flag at Mistral's threshold, « determined based on the optimal
 * performance of our internal test set »: without a measure of our own, the flag rules.
 */

import { Mistral } from '@mistralai/mistralai';
import { HTTPClient } from '@mistralai/mistralai/lib/http.js';
import type { ModerationObject } from '@mistralai/mistralai/models/components';
import type { Logger } from 'pino';
import type { MistralConfig } from '../../config';

const MODEL = 'mistral-moderation-2603';

/*
 * Moderation runs before every reply. During a Mistral incident (2026-10-05), calls answered 503
 * or hung past 5 s while the next ones answered in 150 to 420 ms: a hung attempt is cut and
 * retried, the retries closing before the call's own deadline. The SDK shares one timeout signal
 * between attempts (esm/lib/sdks.js), hence a timeout per attempt of its own (README, « Custom
 * HTTP Client »); it retries 429 and 5xx, waiting at most `maxInterval` between attempts.
 */
const ATTEMPT_MS = 1_500;
const RETRY_WINDOW_MS = 2_500;
const TIMEOUT_MS = 5_000;

/**
 * The categories that hold back what reaches the student. `health`, `financial` and `law` stay
 * out (a biology or civics lesson touches them), `pii` too (the tutor calls the student by their
 * first name), and `jailbreaking`, which concerns the input.
 */
const OUTPUT_BLOCKING = ['sexual', 'hate_and_discrimination', 'violence_and_threats', 'dangerous', 'criminal', 'selfharm'] as const;

/**
 * The categories kept with a student's message. `selfharm` decides distress; the others are
 * measured, not blocking: a history homework touches violence.
 */
const INPUT_RECORDED = ['selfharm', 'sexual', 'jailbreaking', 'pii', 'violence_and_threats', 'dangerous', 'criminal'] as const;

interface InputModeration {
  /** The recorded categories Mistral flags. */
  flagged: string[];
  /** Null when Mistral returns no score: a missing score is not a low one. */
  selfharmScore: number | null;
}

/** Every function throws when moderation is unavailable: a text without its result was not checked. */
export interface Moderation {
  /** The blocking categories of the tutor's reply, read with the student's message for context. */
  reply: (studentText: string, reply: string) => Promise<string[]>;
  /** The blocking categories of each text, in order. */
  texts: (texts: readonly string[]) => Promise<string[][]>;
  /** The student's message, with the tutor's last message for context. */
  studentTurn: (lastTutorText: string | null, studentText: string) => Promise<InputModeration>;
}

function attemptTimeout(ms: number): HTTPClient {
  const client = new HTTPClient();
  client.addHook('beforeRequest', (request) => new Request(request, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(ms)]) }));
  return client;
}

function resultsFor(results: readonly ModerationObject[], count: number): ModerationObject[] {
  if (results.length !== count) throw new Error(`Moderation returned ${String(results.length)} results for ${String(count)} inputs`);
  return [...results];
}

export function createModeration({ mistral, logger }: { mistral: MistralConfig; logger: Logger }): Moderation {
  const sdk = new Mistral({
    // Always passed, even empty: the SDK would otherwise read MISTRAL_API_KEY itself.
    apiKey: mistral.apiKey ?? '',
    serverURL: mistral.serverUrl,
    timeoutMs: TIMEOUT_MS,
    ...(mistral.retryAttempts > 0
      ? {
          retryConfig: {
            strategy: 'backoff',
            backoff: { initialInterval: 500, maxInterval: 1_000, exponent: 1.5, maxElapsedTime: RETRY_WINDOW_MS },
            retryConnectionErrors: true,
          },
          httpClient: attemptTimeout(ATTEMPT_MS),
        }
      : { retryConfig: { strategy: 'none' } }),
  });

  function blocking(result: ModerationObject | undefined): string[] {
    const flagged = OUTPUT_BLOCKING.filter((category) => result?.categories?.[category] === true);
    if (flagged.length > 0) logger.warn({ categories: flagged }, 'Output flagged by moderation');
    return flagged;
  }

  async function texts(inputs: readonly string[]): Promise<string[][]> {
    if (inputs.length === 0) return [];
    const response = await sdk.classifiers.moderate({ model: MODEL, inputs: [...inputs] });
    return resultsFor(response.results, inputs.length).map(blocking);
  }

  return {
    texts,

    async reply(studentText, reply) {
      // A turn without text, a photo alone, moderates the reply by itself.
      if (!studentText.trim()) return (await texts([reply]))[0] ?? [];
      const response = await sdk.classifiers.moderateChat({
        model: MODEL,
        inputs: [
          { role: 'user', content: studentText },
          { role: 'assistant', content: reply },
        ],
      });
      return blocking(resultsFor(response.results, 1)[0]);
    },

    async studentTurn(lastTutorText, studentText) {
      const response = await sdk.classifiers.moderateChat({
        model: MODEL,
        inputs: [...(lastTutorText ? [{ role: 'assistant' as const, content: lastTutorText }] : []), { role: 'user' as const, content: studentText }],
      });
      const [result] = resultsFor(response.results, 1);
      return {
        flagged: INPUT_RECORDED.filter((category) => result?.categories?.[category] === true),
        selfharmScore: result?.categoryScores?.['selfharm'] ?? null,
      };
    },
  };
}
