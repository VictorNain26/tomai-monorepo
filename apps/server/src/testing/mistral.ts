/**
 * A fake Mistral: a real server behind the real fetch, so that the SDKs' timeouts and retries
 * reach it as they reach Mistral. Each test queues the replies it expects; a chat call with
 * nothing queued is refused, so that no test passes on an answer it did not write. Moderation
 * flags nothing unless told to.
 */

import { afterAll } from 'bun:test';
import type { MistralConfig } from '../config';

interface WireUsage {
  prompt_tokens: number;
  completion_tokens: number;
  num_cached_tokens: number;
}

type ChatReply = { text: string; usage?: Partial<WireUsage> } | { json: unknown; usage?: Partial<WireUsage> } | { status: number } | 'hang';

type ModerationReply = { flagged?: string[]; scores?: Record<string, number> } | { status: number } | 'hang';

interface Received {
  path: string;
  body: Record<string, unknown>;
}

const DEFAULT_USAGE: WireUsage = { prompt_tokens: 1000, completion_tokens: 100, num_cached_tokens: 0 };

function error(status: number, message: string): Response {
  return Response.json({ object: 'error', message }, { status });
}

function completion(reply: { text: string; usage?: Partial<WireUsage> } | { json: unknown; usage?: Partial<WireUsage> }): Response {
  const usage = { ...DEFAULT_USAGE, ...reply.usage };
  return Response.json({
    id: crypto.randomUUID(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'mistral-small-2603',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'text' in reply ? reply.text : JSON.stringify(reply.json) },
        finish_reason: 'stop',
      },
    ],
    usage: { ...usage, total_tokens: usage.prompt_tokens + usage.completion_tokens },
  });
}

function moderation(reply: { flagged?: string[]; scores?: Record<string, number> }, count: number): Response {
  const flagged = new Set(reply.flagged);
  const result = {
    categories: Object.fromEntries(['selfharm', 'sexual', 'violence_and_threats', 'dangerous', ...flagged].map((c) => [c, flagged.has(c)])),
    category_scores: reply.scores ?? { selfharm: 0.01 },
  };
  return Response.json({ id: crypto.randomUUID(), model: 'mistral-moderation-2603', results: Array.from({ length: count }, () => result) });
}

export function fakeMistral() {
  const chat: ChatReply[] = [];
  const moderations: ModerationReply[] = [];
  const received: Received[] = [];

  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      const body = (await request.json()) as Record<string, unknown>;
      received.push({ path, body });

      if (path === '/v1/chat/completions') {
        const reply = chat.shift();
        if (reply === undefined) return error(400, 'fake Mistral: no chat reply queued');
        if (reply === 'hang') return new Promise<Response>(() => undefined);
        return 'status' in reply ? error(reply.status, 'fake Mistral error') : completion(reply);
      }
      if (path === '/v1/moderations' || path === '/v1/chat/moderations') {
        const reply = moderations.shift() ?? {};
        if (reply === 'hang') return new Promise<Response>(() => undefined);
        if ('status' in reply) return error(reply.status, 'fake Mistral error');
        // One result per text; a conversation is moderated as one.
        const inputs = body['input'];
        return moderation(reply, path === '/v1/moderations' && Array.isArray(inputs) ? inputs.length : 1);
      }
      return error(404, `fake Mistral: no route ${path}`);
    },
  });
  afterAll(() => server.stop(true));

  const url = server.url.origin;
  /** The server's settings: no retry and a short deadline, unless the test asks otherwise. */
  const config = (overrides: Partial<MistralConfig> = {}): MistralConfig => ({
    apiKey: 'test',
    serverUrl: url,
    euEndpoint: false,
    model: 'mistral-small-2603',
    timeoutMs: 2_000,
    retryAttempts: 0,
    ...overrides,
  });

  return { chat, moderations, received, config };
}
