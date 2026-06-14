/**
 * Mistral AI client wrapper — stack souveraine EU (Phase 2B).
 *
 * Centralise l'accès aux LLM Mistral pour le backend. Utilise le SDK officiel
 * `@mistralai/mistralai` 2.2.1+ et complète par un appel HTTP direct quand le
 * SDK n'expose pas un paramètre (cas : `prompt_cache_key` documenté dans
 * l'API HTTP mais absent du SDK TypeScript — confirmé par inspection v2.2.1
 * en mai 2026).
 *
 * Trois fonctions exportées :
 * - `generateText` — completion non-streaming simple (auto-title, classification…)
 * - `generateStructured` — completion JSON Schema strict (intent classifier…)
 * - `chatStream` — completion streaming SSE (chat-orchestration)
 *
 * Toutes supportent `promptCacheKey` (90 % discount sur cached tokens).
 */

import type {
  AssistantMessage as SdkAssistantMessage,
  SystemMessage as SdkSystemMessage,
  UserMessage as SdkUserMessage,
  ToolMessage as SdkToolMessage,
  Tool as SdkTool,
} from '@mistralai/mistralai/models/components/index.js';
import { Mistral } from '@mistralai/mistralai';
import { env } from '../../config/env.js';
import { logger } from '../observability.js';
import { withGenAiSpan } from '../otel/index.js';

// ── Singleton client SDK ────────────────────────────────────────────────────

let instance: Mistral | null = null;

function getClient(): Mistral {
  if (!env.MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY manquante — configurer .env');
  }
  instance ??= new Mistral({ apiKey: env.MISTRAL_API_KEY });
  return instance;
}

/** Test hook : injecter un mock client. */
export function setMistralClient(client: Mistral | null): void {
  instance = client;
}

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
 * ToolCall — matches SDK v2.2.1 ToolCall structure.
 * Captures function-call requests from the assistant.
 */
export interface MistralToolCall {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
  index?: number;
}

/**
 * Discriminated union of Mistral message types — exactly isomorphic with SDK v2.2.1
 * ChatCompletionRequestMessage for zero-cast compatibility.
 *
 * Callers MUST ensure:
 * - `system` role: content must be string (not undefined)
 * - `user` role: content must be string (not undefined)
 * - `assistant` role: role is forced to "assistant", optional toolCalls
 * - `tool` role: toolCallId must be present (not undefined)
 */
export type MistralMessage =
  | { role: 'system'; content: string | SdkSystemMessage['content'] }
  | { role: 'user'; content: string | SdkUserMessage['content'] }
  | (SdkAssistantMessage & { role: 'assistant' })
  | { role: 'tool'; content: string | SdkToolMessage['content']; toolCallId: string; name?: string };

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
  /** JSON Schema strict (mode `json_schema` du SDK Mistral). */
  schema: Record<string, unknown>;
  /** Pour le typing fort côté caller — sera retourné JSON.parse-é. */
  expectedType?: () => T;
}

interface ChatStreamOptions {
  messages: MistralMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptCacheKey?: string;
  /** Tools function-calling Mistral. Matches SDK v2.2.1 Tool structure. */
  tools?: SdkTool[];
  /** Disable parallel tool calls for deterministic sequential execution. */
  parallelToolCalls?: boolean;
}

export interface ChatStreamChunk {
  type: 'text' | 'tool_call' | 'done';
  text?: string;
  toolCall?: { id: string; name: string; arguments: string };
  /** Présent uniquement sur le chunk 'done' — usage du stream complet. */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens: number };
}

// ── Helpers internes ────────────────────────────────────────────────────────

const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';

/**
 * POST direct au lieu du SDK quand on a besoin d'un param non exposé par le
 * SDK TS officiel (cas : `prompt_cache_key`). Le SDK fait le retry interne ;
 * ici on fait du retry exponentiel léger sur 429/5xx pour matcher.
 */
async function postChatCompletion(body: Record<string, unknown>, timeoutMs = 60000) {
  if (!env.MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY manquante');
  }
  const maxAttempts = env.MISTRAL_RETRY_ATTEMPTS;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // RequestInit cast: when mobile typecheck transitively imports server
      // via Eden Treaty, its DOM/RN AbortSignal globals diverge from Node's.
      // The cast confines the disagreement to one line; runtime is unaffected.
      const init: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs) as RequestInit['signal'],
      };
      const res = await fetch(`${MISTRAL_API_BASE}/chat/completions`, init);

      if (res.ok) {
        return (await res.json()) as Record<string, unknown>;
      }

      const errText = await res.text();
      const transient = res.status === 429 || res.status >= 500;
      lastErr = new Error(`Mistral API ${res.status}: ${errText.slice(0, 200)}`);
      if (!transient || attempt === maxAttempts - 1) throw lastErr;

      const wait = env.MISTRAL_RETRY_DELAY * 2 ** attempt;
      logger.warn('Mistral chat retry', {
        operation: 'mistral:chat:retry',
        status: res.status,
        attempt: attempt + 1,
        waitMs: wait,
      });
      await new Promise((r) => setTimeout(r, wait));
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts - 1) throw err;
      const wait = env.MISTRAL_RETRY_DELAY * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ── API publique ────────────────────────────────────────────────────────────

/**
 * Génération texte simple (non-streaming). Retourne le contenu string.
 * Utilise POST direct si `promptCacheKey` fourni (SDK ne l'expose pas).
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
      if (opts.promptCacheKey) {
        const data = await postChatCompletion(
          {
            model,
            messages: opts.messages,
            temperature,
            max_tokens: maxTokens,
            prompt_cache_key: opts.promptCacheKey,
            safe_prompt: true,
          },
          timeoutMs,
        );
        const choices = (data['choices'] as Array<Record<string, unknown>>) ?? [];
        const message = choices[0]?.['message'] as Record<string, unknown> | undefined;
        const usage = data['usage'] as { prompt_tokens?: number; completion_tokens?: number } | undefined;
        recordResponse({
          id: typeof data['id'] === 'string' ? data['id'] : undefined,
          model: typeof data['model'] === 'string' ? data['model'] : undefined,
          finishReasons: [String(choices[0]?.['finish_reason'] ?? 'stop')],
          inputTokens: usage?.prompt_tokens,
          outputTokens: usage?.completion_tokens,
        });
        return String(message?.['content'] ?? '');
      }

      const client = getClient();
      const res = await client.chat.complete({
        model,
        messages: opts.messages,
        temperature,
        maxTokens,
        safePrompt: true,
      });
      const finish = res.choices?.[0]?.finishReason;
      recordResponse({
        id: res.id,
        model: res.model,
        finishReasons: finish ? [String(finish)] : undefined,
        inputTokens: res.usage?.promptTokens,
        outputTokens: res.usage?.completionTokens,
      });
      return String(res.choices?.[0]?.message?.content ?? '');
    },
  );
}

/**
 * Génération structurée JSON Schema. Garantit que la sortie respecte le schéma
 * (mode `json_schema` natif Mistral). Le caller parse / valide.
 */
export async function generateStructured<T = unknown>(
  opts: GenerateStructuredOptions<T>,
): Promise<T> {
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
      const body: Record<string, unknown> = {
        model,
        messages: opts.messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_schema', json_schema: opts.schema },
        safe_prompt: true,
      };
      if (opts.promptCacheKey) body['prompt_cache_key'] = opts.promptCacheKey;

      const data = await postChatCompletion(body, timeoutMs);
      const choices = (data['choices'] as Array<Record<string, unknown>>) ?? [];
      const message = choices[0]?.['message'] as Record<string, unknown> | undefined;
      const usage = data['usage'] as { prompt_tokens?: number; completion_tokens?: number } | undefined;
      recordResponse({
        id: typeof data['id'] === 'string' ? data['id'] : undefined,
        model: typeof data['model'] === 'string' ? data['model'] : undefined,
        finishReasons: [String(choices[0]?.['finish_reason'] ?? 'stop')],
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
      });
      const content = String(message?.['content'] ?? '');
      return JSON.parse(content) as T;
    },
  );
}

/**
 * Chat streaming — yields chunks au fur et à mesure. Pour SSE backend.
 * NOTE : si `promptCacheKey` est utilisé, on bypass le SDK et on lit le
 * stream SSE manuellement (SDK ne forward pas le param).
 */
export async function* chatStream(opts: ChatStreamOptions): AsyncIterable<ChatStreamChunk> {
  if (!env.MISTRAL_API_KEY) throw new Error('Mistral non configuré');

  const model = opts.model ?? env.MISTRAL_MODEL;
  const temperature = opts.temperature ?? env.MISTRAL_TEMPERATURE;
  const maxTokens = opts.maxTokens ?? env.MISTRAL_MAX_TOKENS;

  if (!opts.promptCacheKey) {
    // Path SDK officiel — plus simple, gère le parsing SSE
    const client = getClient();
    const stream = await client.chat.stream({
      model,
      messages: opts.messages,
      temperature,
      maxTokens,
      tools: opts.tools,
      safePrompt: true,
      parallelToolCalls: opts.parallelToolCalls ?? false,
    });
    let usage: ChatStreamChunk['usage'];
    for await (const event of stream) {
      const u = event.data?.usage;
      if (u) {
        usage = {
          promptTokens: u.promptTokens ?? 0,
          completionTokens: u.completionTokens ?? 0,
          totalTokens: u.totalTokens ?? ((u.promptTokens ?? 0) + (u.completionTokens ?? 0)),
          cachedTokens: (u as { promptTokensDetails?: { cachedTokens?: number } }).promptTokensDetails?.cachedTokens ?? 0,
        };
      }
      const delta = event.data?.choices?.[0]?.delta;
      if (delta?.content) {
        const text = typeof delta.content === 'string'
          ? delta.content
          : delta.content.map((c) => ('text' in c ? c.text : '')).join('');
        yield { type: 'text', text };
      }
      for (const tc of delta?.toolCalls ?? []) {
        yield {
          type: 'tool_call',
          toolCall: {
            id: tc.id ?? '',
            name: tc.function?.name ?? '',
            arguments: tc.function?.arguments
              ? typeof tc.function.arguments === 'string'
                ? tc.function.arguments
                : JSON.stringify(tc.function.arguments)
              : '',
          },
        };
      }
    }
    yield { type: 'done', usage };
    return;
  }

  // Path POST direct — pour prompt_cache_key. Parse SSE manuellement.
  // Convert our camelCase MistralMessage to the snake_case wire shape Mistral
  // expects (tool_calls, tool_call_id). The SDK path does this automatically.
  const wireMessages = opts.messages.map((m) => {
    const out: Record<string, unknown> = { role: m.role, content: m.content };
    // Narrow by role to access role-specific fields safely.
    if (m.role === 'assistant' && 'toolCalls' in m && m.toolCalls) {
      out['tool_calls'] = m.toolCalls;
    }
    if (m.role === 'tool') {
      if ('toolCallId' in m && m.toolCallId) out['tool_call_id'] = m.toolCallId;
      if ('name' in m && m.name) out['name'] = m.name;
    }
    return out;
  });

  const body: Record<string, unknown> = {
    model,
    messages: wireMessages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
    prompt_cache_key: opts.promptCacheKey,
    safe_prompt: true,
    // Disable parallel tool execution for deterministic sequential flow.
    // Mistral can call multiple tools in a single turn; sequential mode
    // ensures each tool result is fed back before the next tool is called.
    parallel_tool_calls: opts.parallelToolCalls ?? false,
  };
  if (opts.tools) body['tools'] = opts.tools;

  const res = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Mistral stream ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage: ChatStreamChunk['usage'];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const event = JSON.parse(payload);
        const u = event.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | null | undefined;
        if (u) {
          usage = {
            promptTokens: u.prompt_tokens ?? 0,
            completionTokens: u.completion_tokens ?? 0,
            totalTokens: u.total_tokens ?? ((u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0)),
            cachedTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
          };
        }
        const delta = event.choices?.[0]?.delta;
        if (delta?.content) yield { type: 'text', text: String(delta.content) };
        for (const tc of delta?.tool_calls ?? []) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              arguments: tc.function?.arguments ?? '',
            },
          };
        }
      } catch {
        // ligne SSE malformée — ignorer (parfois keep-alive ou commentaire)
      }
    }
  }
  if (!usage) {
    logger.warn('Mistral stream ended without usage', {
      operation: 'mistral:chat:usage-missing',
    });
  }
  yield { type: 'done', usage };
}
