/**
 * Mistral non-streaming completions — routed through the Vercel AI SDK.
 *
 * Streaming chat lives in `ai-chat.service.ts` (Task 4, `streamText`). This
 * module keeps the two remaining non-chat-stream shapes:
 *
 * - `generateText` — completion non-streaming simple (vision, analyse doc, résumé, titre…)
 * - `generateStructured` — completion JSON Schema strict (intent classifier, cartes, épisodes…)
 *
 * Both go through `mistralProvider` (`lib/ai/provider.ts`), which injects
 * `prompt_cache_key` on the wire request — the AI SDK's `MistralProvider`
 * has no first-class option for it (confirmed against `@ai-sdk/mistral` 4.0.5).
 */

import { generateText as aiGenerateText, generateObject as aiGenerateObject, jsonSchema, type ModelMessage, type TextPart, type FilePart, type JSONSchema7 } from 'ai';
import { mistralProvider } from './provider.js';
import { env } from '../../config/env.js';
import { withGenAiSpan } from '../otel/index.js';

// ── Types domain ────────────────────────────────────────────────────────────

/**
 * Multimodal content parts (vision). Mistral models with vision (medium 3.5 /
 * pixtral fusion) accept `image_url` parts inline alongside text. The `url`
 * shape supports both `data:` URIs and absolute https URLs.
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
  /** JSON Schema wrapper — `{ name, strict, schema }`, forme Mistral `response_format.json_schema`. */
  schema: Record<string, unknown>;
  /** Pour le typing fort côté caller — sera retourné directement (déjà objet, plus de JSON.parse). */
  expectedType?: () => T;
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

/**
 * Pulls the raw JSON Schema (`.schema`) and name out of the Mistral
 * `response_format.json_schema` wrapper callers already build (unchanged in
 * this task — see `episodic-memory.service.ts` / `intent-classifier.service.ts`
 * / `card-generator.service.ts` for the wrapper shape).
 */
function extractJsonSchema(wrapper: Record<string, unknown>): { name?: string; schema: JSONSchema7 } {
  const schema = wrapper['schema'];
  if (!schema || typeof schema !== 'object') {
    throw new Error('generateStructured: schema.schema (JSON Schema) manquant');
  }
  const name = wrapper['name'];
  return { name: typeof name === 'string' ? name : undefined, schema: schema as JSONSchema7 };
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
      serverAddress: 'api.mistral.ai',
    },
    async (recordResponse) => {
      const result = await aiGenerateText({
        model: mistralProvider(opts.promptCacheKey)(model),
        messages: toModelMessages(opts.messages),
        allowSystemInMessages: true,
        temperature,
        maxOutputTokens: maxTokens,
        maxRetries: env.MISTRAL_RETRY_ATTEMPTS,
        abortSignal: AbortSignal.timeout(timeoutMs),
        providerOptions: { mistral: { safePrompt: true } },
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
 * Génération structurée JSON Schema. Garantit que la sortie respecte le schéma
 * (mode `json_schema` strict natif Mistral, via `generateObject`).
 */
export async function generateStructured<T = unknown>(
  opts: GenerateStructuredOptions<T>,
): Promise<T> {
  if (!env.MISTRAL_API_KEY) throw new Error('Mistral non configuré');

  const model = opts.model ?? env.MISTRAL_MODEL;
  const temperature = opts.temperature ?? env.MISTRAL_TEMPERATURE;
  const maxTokens = opts.maxTokens ?? env.MISTRAL_MAX_TOKENS;
  const timeoutMs = opts.timeoutMs ?? env.MISTRAL_TIMEOUT;
  const { name, schema } = extractJsonSchema(opts.schema);

  return withGenAiSpan(
    {
      operation: 'chat',
      provider: 'mistral_ai',
      model,
      maxTokens,
      temperature,
      serverAddress: 'api.mistral.ai',
    },
    async (recordResponse) => {
      const result = await aiGenerateObject({
        model: mistralProvider(opts.promptCacheKey)(model),
        messages: toModelMessages(opts.messages),
        allowSystemInMessages: true,
        schema: jsonSchema<T>(schema),
        schemaName: name,
        temperature,
        maxOutputTokens: maxTokens,
        maxRetries: env.MISTRAL_RETRY_ATTEMPTS,
        abortSignal: AbortSignal.timeout(timeoutMs),
        providerOptions: { mistral: { safePrompt: true, strictJsonSchema: true } },
      });
      recordResponse({
        id: result.response.id,
        model: result.response.modelId,
        finishReasons: [result.finishReason],
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
      return result.object;
    },
  );
}
