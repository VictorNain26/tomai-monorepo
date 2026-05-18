/**
 * Mistral AI client wrapper — stack souveraine EU (Phase 2B).
 *
 * Centralise l'accès aux LLM Mistral pour le backend. Wrappe le SDK officiel
 * `@mistralai/mistralai` 1.13+ et complète par un appel HTTP direct quand le
 * SDK n'expose pas un paramètre (cas : `prompt_cache_key` documenté dans
 * l'API HTTP mais absent du `ChatCompletionRequest` du SDK TS — confirmé par
 * lecture node_modules en mai 2026).
 *
 * Trois fonctions exportées :
 * - `generateText` — completion non-streaming simple (auto-title, classification…)
 * - `generateStructured` — completion JSON Schema strict (intent classifier…)
 * - `chatStream` — completion streaming SSE (chat-orchestration)
 *
 * Toutes supportent `promptCacheKey` (90 % discount sur cached tokens).
 */

import { Mistral } from '@mistralai/mistralai';
import { appConfig } from '../../config/app.config.js';
import { logger } from '../observability.js';

// ── Singleton client SDK ────────────────────────────────────────────────────

let instance: Mistral | null = null;

function getClient(): Mistral {
  const cfg = appConfig.ai.mistral;
  if (!cfg?.apiKey) {
    throw new Error('MISTRAL_API_KEY manquante — configurer .env');
  }
  instance ??= new Mistral({ apiKey: cfg.apiKey });
  return instance;
}

/** Test hook : injecter un mock client. */
export function setMistralClient(client: Mistral | null): void {
  instance = client;
}

// ── Types domain ────────────────────────────────────────────────────────────

export type MistralRole = 'system' | 'user' | 'assistant' | 'tool';

export interface MistralMessage {
  role: MistralRole;
  content: string;
}

export interface GenerateTextOptions {
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

export interface GenerateStructuredOptions<T> extends GenerateTextOptions {
  /** JSON Schema strict (mode `json_schema` du SDK Mistral). */
  schema: Record<string, unknown>;
  /** Pour le typing fort côté caller — sera retourné JSON.parse-é. */
  expectedType?: () => T;
}

export interface ChatStreamOptions {
  messages: MistralMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptCacheKey?: string;
  /** Tools function-calling Mistral. */
  tools?: Array<Record<string, unknown>>;
}

export interface ChatStreamChunk {
  type: 'text' | 'tool_call' | 'done';
  text?: string;
  toolCall?: { id: string; name: string; arguments: string };
}

// ── Helpers internes ────────────────────────────────────────────────────────

const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';

/**
 * POST direct au lieu du SDK quand on a besoin d'un param non exposé par le
 * SDK TS officiel (cas : `prompt_cache_key`). Le SDK fait le retry interne ;
 * ici on fait du retry exponentiel léger sur 429/5xx pour matcher.
 */
async function postChatCompletion(body: Record<string, unknown>, timeoutMs = 60000) {
  const cfg = appConfig.ai.mistral;
  if (!cfg?.apiKey) {
    throw new Error('MISTRAL_API_KEY manquante');
  }
  const maxAttempts = cfg.retryAttempts ?? 3;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // RequestInit cast: when mobile typecheck transitively imports server
      // via Eden Treaty, its DOM/RN AbortSignal globals diverge from Node's.
      // The cast confines the disagreement to one line; runtime is unaffected.
      const init: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
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

      const wait = (cfg.retryDelay ?? 1000) * 2 ** attempt;
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
      const wait = (cfg.retryDelay ?? 1000) * 2 ** attempt;
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
  const cfg = appConfig.ai.mistral;
  if (!cfg) throw new Error('Mistral non configuré');

  const model = opts.model ?? cfg.model;
  const temperature = opts.temperature ?? cfg.temperature;
  const maxTokens = opts.maxTokens ?? cfg.maxTokens;
  const timeoutMs = opts.timeoutMs ?? cfg.requestTimeout;

  if (opts.promptCacheKey) {
    const data = await postChatCompletion(
      {
        model,
        messages: opts.messages,
        temperature,
        max_tokens: maxTokens,
        prompt_cache_key: opts.promptCacheKey,
      },
      timeoutMs,
    );
    const choices = (data['choices'] as Array<Record<string, unknown>>) ?? [];
    const message = choices[0]?.['message'] as Record<string, unknown> | undefined;
    return String(message?.['content'] ?? '');
  }

  const client = getClient();
  const res = await client.chat.complete({
    model,
    messages: opts.messages,
    temperature,
    maxTokens,
  });
  return String(res.choices?.[0]?.message?.content ?? '');
}

/**
 * Génération structurée JSON Schema. Garantit que la sortie respecte le schéma
 * (mode `json_schema` natif Mistral). Le caller parse / valide.
 */
export async function generateStructured<T = unknown>(
  opts: GenerateStructuredOptions<T>,
): Promise<T> {
  const cfg = appConfig.ai.mistral;
  if (!cfg) throw new Error('Mistral non configuré');

  const model = opts.model ?? cfg.model;
  const temperature = opts.temperature ?? cfg.temperature;
  const maxTokens = opts.maxTokens ?? cfg.maxTokens;
  const timeoutMs = opts.timeoutMs ?? cfg.requestTimeout;

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_schema', json_schema: opts.schema },
  };
  if (opts.promptCacheKey) body['prompt_cache_key'] = opts.promptCacheKey;

  const data = await postChatCompletion(body, timeoutMs);
  const choices = (data['choices'] as Array<Record<string, unknown>>) ?? [];
  const message = choices[0]?.['message'] as Record<string, unknown> | undefined;
  const content = String(message?.['content'] ?? '');
  return JSON.parse(content) as T;
}

/**
 * Chat streaming — yields chunks au fur et à mesure. Pour SSE backend.
 * NOTE : si `promptCacheKey` est utilisé, on bypass le SDK et on lit le
 * stream SSE manuellement (SDK ne forward pas le param).
 */
export async function* chatStream(opts: ChatStreamOptions): AsyncIterable<ChatStreamChunk> {
  const cfg = appConfig.ai.mistral;
  if (!cfg) throw new Error('Mistral non configuré');

  const model = opts.model ?? cfg.model;
  const temperature = opts.temperature ?? cfg.temperature;
  const maxTokens = opts.maxTokens ?? cfg.maxTokens;

  if (!opts.promptCacheKey) {
    // Path SDK officiel — plus simple, gère le parsing SSE
    const client = getClient();
    const stream = await client.chat.stream({
      model,
      messages: opts.messages,
      temperature,
      maxTokens,
      tools: opts.tools as never,
    });
    for await (const event of stream) {
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
    yield { type: 'done' };
    return;
  }

  // Path POST direct — pour prompt_cache_key. Parse SSE manuellement.
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
    prompt_cache_key: opts.promptCacheKey,
  };
  if (opts.tools) body['tools'] = opts.tools;

  const res = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
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
  yield { type: 'done' };
}
