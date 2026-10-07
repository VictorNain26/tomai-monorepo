/**
 * Mistral calls that are not streamed, through the AI SDK and its Mistral provider: plain text,
 * and output validated by a Zod schema (Mistral's `json_schema`, strict). Each call is written to
 * `ai_cost` for its student, an answer outside the schema too: it was billed all the same.
 */

import { createMistral, type MistralLanguageModelChatOptions } from '@ai-sdk/mistral';
import { generateText as generate, NoObjectGeneratedError, Output, TypeValidationError, type LanguageModelUsage, type ModelMessage } from 'ai';
import type { Logger } from 'pino';
import type { z } from 'zod';
import type { MistralConfig } from '../../config';
import type { Db } from '../db/client';
import { pricing, type Usage } from './cost';
import { insertCost } from './repository';

/** Who a call is billed to: a student, or nobody outside a student (evaluation, live tests). */
type Owner = { studentId: string } | null;

export interface TextCall {
  /** What the call is for, written with its cost: `turn-analysis`, `exercise-sheet`… */
  operation: string;
  owner: Owner;
  system: string;
  messages: ModelMessage[];
  temperature?: number;
  /** Ignored with `reasoningEffort: 'high'`: the thinking counts in the output, the timeout bounds the call. */
  maxOutputTokens?: number;
  /** Mistral's prompt cache: stable while the start of the prompt is (docs.mistral.ai/api/endpoint/chat). */
  promptCacheKey?: string;
  reasoningEffort?: 'none' | 'high';
  /** A deadline shorter than the configured one, for a call the turn waits on; never longer. */
  timeoutMs?: number;
}

interface StructuredCall<T> extends TextCall {
  schema: z.ZodType<T>;
  schemaName: string;
  /** Sent as `random_seed`: the same seed gives the same output. */
  seed?: number;
  /** Asks once more, with the validation error, when the answer misses the schema; on by default. */
  repairInvalid?: boolean;
}

export interface Ai {
  generateText: (call: TextCall) => Promise<string>;
  generateStructured: <T>(call: StructuredCall<T>) => Promise<{ object: T; usage: Usage }>;
}

function usageOf(usage: LanguageModelUsage | undefined): Usage {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    cachedInputTokens: usage?.inputTokenDetails.cacheReadTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
  };
}

function sum(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

export function createAi({ mistral, db, logger }: { mistral: MistralConfig; db: Db; logger: Logger }): Ai {
  // The key always passed, even empty: the provider would otherwise read MISTRAL_API_KEY itself.
  const provider = createMistral({ baseURL: `${mistral.serverUrl}/v1`, apiKey: mistral.apiKey ?? '' });
  const model = provider(mistral.model);
  // Throws at boot for a model without a price: its calls would escape the quota.
  const costOf = pricing(mistral.model, mistral.euEndpoint);

  /** A failed write is logged, never thrown: the student already has the answer. */
  async function record(call: TextCall, usage: Usage): Promise<void> {
    if (!call.owner) return;
    try {
      await insertCost(db, {
        studentId: call.owner.studentId,
        model: mistral.model,
        operation: call.operation,
        ...usage,
        costMicroEur: costOf(usage),
      });
    } catch (err) {
      logger.error({ err, operation: call.operation }, 'AI cost not written');
    }
  }

  const deadline = (call: TextCall) => Math.min(call.timeoutMs ?? Infinity, mistral.timeoutMs);

  function settings(call: TextCall, abortSignal: AbortSignal) {
    const reasoning = call.reasoningEffort ?? 'none';
    return {
      model,
      system: call.system,
      ...(call.temperature === undefined ? {} : { temperature: call.temperature }),
      ...(reasoning === 'high' || call.maxOutputTokens === undefined ? {} : { maxOutputTokens: call.maxOutputTokens }),
      maxRetries: mistral.retryAttempts,
      abortSignal,
      providerOptions: {
        mistral: {
          reasoningEffort: reasoning,
          ...(call.promptCacheKey === undefined ? {} : { promptCacheKey: call.promptCacheKey }),
          strictJsonSchema: true,
        } satisfies MistralLanguageModelChatOptions,
      },
    };
  }

  return {
    async generateText(call) {
      const result = await generate({ ...settings(call, AbortSignal.timeout(deadline(call))), messages: call.messages });
      await record(call, usageOf(result.usage));
      return result.text;
    },

    async generateStructured<T>(call: StructuredCall<T>) {
      // One deadline for the call and its repair.
      const abortSignal = AbortSignal.timeout(deadline(call));
      const attempt = async (messages: ModelMessage[]) => {
        try {
          const result = await generate({
            ...settings(call, abortSignal),
            messages,
            output: Output.object({ schema: call.schema, name: call.schemaName }),
            ...(call.seed === undefined ? {} : { seed: call.seed }),
          });
          const usage = usageOf(result.usage);
          await record(call, usage);
          return { object: result.output, usage };
        } catch (error) {
          if (NoObjectGeneratedError.isInstance(error)) await record(call, usageOf(error.usage));
          throw error;
        }
      };

      try {
        return await attempt(call.messages);
      } catch (error) {
        if (call.repairInvalid === false || !NoObjectGeneratedError.isInstance(error) || !TypeValidationError.isInstance(error.cause)) throw error;
        const repaired = await attempt([
          ...call.messages,
          { role: 'assistant', content: error.text ?? '' },
          { role: 'user', content: `Ta réponse ne respecte pas le schéma attendu : ${error.cause.message}. Renvoie un JSON corrigé.` },
        ]);
        return { object: repaired.object, usage: sum(usageOf(error.usage), repaired.usage) };
      }
    },
  };
}
