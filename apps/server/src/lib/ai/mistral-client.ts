/**
 * Mistral non-streaming completions — routed through the Vercel AI SDK.
 *
 * Streaming chat lives in `ai-chat.service.ts` (Task 4, `streamText`). This
 * module keeps the two remaining non-chat-stream shapes:
 *
 * - `generateText` — completion non-streaming simple (vision, analyse doc, résumé, titre…)
 * - `generateStructured` — sortie structurée Zod en JSON Schema strict (intent classifier, cartes, épisodes…)
 *
 * Both go through `mistralProvider` (`lib/ai/provider.ts`, EU endpoint).
 * Every call runs with `reasoningEffort: 'none'`: reasoning is reserved to the
 * chat turn (`ai-chat.service.ts`).
 */

import { generateText as aiGenerateText, Output, NoObjectGeneratedError, TypeValidationError, type LanguageModelUsage, type ModelMessage, type TextPart, type FilePart } from 'ai';
import type { z } from 'zod';
import type { MistralLanguageModelChatOptions } from '@ai-sdk/mistral';
import { mistralProvider } from './provider.js';
import { env } from '../../config/env.js';
import { withGenAiSpan } from '../otel/index.js';

// ── Types domain ────────────────────────────────────────────────────────────

/**
 * Multimodal content parts (vision). Mistral Small 4 accepts `image_url` parts
 * inline alongside text. The `url` shape supports both `data:` URIs and
 * absolute https URLs.
 */
export type MistralContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; imageUrl: string | { url: string } };

/**
 * Vendor-neutral message shape shared by every non-streaming call site.
 * `chatStream` used to also carry `assistant`/`tool` roles with tool-call
 * metadata for the agentic loop — that loop moved to `ai-chat.service.ts`
 * (`streamText`'s own tool loop), so this union only needs what
 * `generateText`/`generateStructured` callers actually build.
 */
export type MistralMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | MistralContentPart[] }
  | { role: 'assistant'; content: string };

interface GenerateTextOptions {
  messages: MistralMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Active prompt caching Mistral (-90 % cached tokens). Doit rester stable
   * tant que le préfixe du prompt (system + tools + early messages) ne change
   * pas — bumper en `vN+1` quand le prompt évolue, sinon zéro réutilisation.
   * Voir https://docs.mistral.ai/api/endpoint/chat#prompt-cache.
   */
  promptCacheKey?: string;
  timeoutMs?: number;
}

interface GenerateStructuredOptions<T> extends GenerateTextOptions {
  schema: z.ZodType<T>;
  schemaName: string;
}

export interface StructuredUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredResult<T> {
  object: T;
  usage: StructuredUsage;
}

// ── Helpers internes ────────────────────────────────────────────────────────

function toUserPart(part: MistralContentPart): TextPart | FilePart {
  if (part.type === 'text') return { type: 'text', text: part.text };
  const url = typeof part.imageUrl === 'string' ? part.imageUrl : part.imageUrl.url;
  return { type: 'file', mediaType: 'image', data: new URL(url) };
}

function toModelMessages(messages: MistralMessage[]): ModelMessage[] {
  return messages.map((message): ModelMessage => {
    if (message.role === 'user') {
      return {
        role: 'user',
        content: typeof message.content === 'string' ? message.content : message.content.map(toUserPart),
      };
    }
    return { role: message.role, content: message.content };
  });
}

function toUsage(usage: LanguageModelUsage | undefined): StructuredUsage {
  return { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 };
}

// ── API publique ────────────────────────────────────────────────────────────

/**
 * Génération texte simple (non-streaming). Retourne le contenu string.
 */
export async function generateText(opts: GenerateTextOptions): Promise<string> {
  if (!env.MISTRAL_API_KEY) throw new Error('Mistral non configuré');

  const model = opts.model ?? env.MISTRAL_MODEL;
  const temperature = opts.temperature ?? env.MISTRAL_TEMPERATURE;
  const maxTokens = opts.maxTokens ?? env.MISTRAL_MAX_TOKENS;
  const timeoutMs = opts.timeoutMs ?? env.MISTRAL_TIMEOUT;

  return withGenAiSpan(
    {
      operation: 'chat',
      provider: 'mistral_ai',
      model,
      maxTokens,
      temperature,
      serverAddress: new URL(env.MISTRAL_SERVER_URL).host,
    },
    async (recordResponse) => {
      const result = await aiGenerateText({
        model: mistralProvider()(model),
        messages: toModelMessages(opts.messages),
        allowSystemInMessages: true,
        temperature,
        maxOutputTokens: maxTokens,
        maxRetries: env.MISTRAL_RETRY_ATTEMPTS,
        abortSignal: AbortSignal.timeout(timeoutMs),
        providerOptions: {
          mistral: {
            safePrompt: true,
            reasoningEffort: 'none',
            promptCacheKey: opts.promptCacheKey,
          } satisfies MistralLanguageModelChatOptions,
        },
      });
      recordResponse({
        id: result.response.id,
        model: result.response.modelId,
        finishReasons: [result.finishReason],
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
      return result.text;
    },
  );
}

/**
 * Génération structurée validée par un schéma Zod (`json_schema` strict natif
 * Mistral). Une sortie hors schéma est relancée une seule fois avec l'erreur de
 * validation ; l'usage renvoyé cumule les deux appels.
 */
export async function generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<StructuredResult<T>> {
  if (!env.MISTRAL_API_KEY) throw new Error('Mistral non configuré');

  const model = opts.model ?? env.MISTRAL_MODEL;
  const temperature = opts.temperature ?? env.MISTRAL_TEMPERATURE;
  const maxTokens = opts.maxTokens ?? env.MISTRAL_MAX_TOKENS;
  const timeoutMs = opts.timeoutMs ?? env.MISTRAL_TIMEOUT;

  return withGenAiSpan(
    {
      operation: 'chat',
      provider: 'mistral_ai',
      model,
      maxTokens,
      temperature,
      serverAddress: new URL(env.MISTRAL_SERVER_URL).host,
    },
    async (recordResponse) => {
      const call = async (messages: ModelMessage[]) => {
        const result = await aiGenerateText({
          model: mistralProvider()(model),
          messages,
          allowSystemInMessages: true,
          output: Output.object({ schema: opts.schema, name: opts.schemaName }),
          temperature,
          maxOutputTokens: maxTokens,
          maxRetries: env.MISTRAL_RETRY_ATTEMPTS,
          abortSignal: AbortSignal.timeout(timeoutMs),
          providerOptions: {
            mistral: {
              safePrompt: true,
              strictJsonSchema: true,
              reasoningEffort: 'none',
              promptCacheKey: opts.promptCacheKey,
            } satisfies MistralLanguageModelChatOptions,
          },
        });
        recordResponse({
          id: result.response.id,
          model: result.response.modelId,
          finishReasons: [result.finishReason],
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        });
        return { object: result.output, usage: toUsage(result.usage) };
      };

      const messages = toModelMessages(opts.messages);
      try {
        return await call(messages);
      } catch (error) {
        if (!NoObjectGeneratedError.isInstance(error) || !TypeValidationError.isInstance(error.cause)) throw error;
        const retry = await call([
          ...messages,
          { role: 'assistant', content: error.text ?? '' },
          { role: 'user', content: `Ta réponse ne respecte pas le schéma attendu : ${error.cause.message}. Renvoie un JSON corrigé.` },
        ]);
        const first = toUsage(error.usage);
        return {
          object: retry.object,
          usage: {
            inputTokens: first.inputTokens + retry.usage.inputTokens,
            outputTokens: first.outputTokens + retry.usage.outputTokens,
          },
        };
      }
    },
  );
}
