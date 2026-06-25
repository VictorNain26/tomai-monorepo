import './_helpers/mistral-env';
import { describe, it, expect, afterEach } from 'bun:test';
import type { Mistral } from '@mistralai/mistralai';
import { chatStream, setMistralClient, type ChatStreamChunk } from '../lib/ai/mistral-client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  setMistralClient(null);
  globalThis.fetch = originalFetch;
});

async function collect(iter: AsyncIterable<ChatStreamChunk>): Promise<ChatStreamChunk[]> {
  const out: ChatStreamChunk[] = [];
  for await (const c of iter) out.push(c);
  return out;
}

describe('chatStream usage (SDK path)', () => {
  it('yields the final usage on the done chunk', async () => {
    const events = [
      { data: { choices: [{ delta: { content: 'Bon' } }], usage: null } },
      { data: { choices: [{ delta: { content: 'jour' } }], usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } } },
    ];
    const mockClient = {
      chat: { stream: async () => (async function* () { yield* events; })() },
    } as unknown as Mistral;
    setMistralClient(mockClient);

    const chunks = await collect(chatStream({ messages: [{ role: 'user', content: 'salut' }] }));
    const done = chunks.find((c) => c.type === 'done');
    expect(done?.usage).toEqual({ promptTokens: 100, completionTokens: 50, totalTokens: 150, cachedTokens: 0 });
  });
});

describe('chatStream usage (HTTP direct path, promptCacheKey)', () => {
  it('parses snake_case usage from the final SSE chunk', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Bonjour"}}],"usage":null}',
      'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":120,"completion_tokens":80,"total_tokens":200}}',
      'data: [DONE]',
      '',
    ].join('\n');
    globalThis.fetch = (async () => new Response(sse, { status: 200 })) as unknown as typeof fetch;

    const chunks = await collect(chatStream({
      messages: [{ role: 'user', content: 'salut' }],
      promptCacheKey: 'test-v1',
    }));
    const done = chunks.find((c) => c.type === 'done');
    expect(done?.usage).toEqual({ promptTokens: 120, completionTokens: 80, totalTokens: 200, cachedTokens: 0 });
  });
});

describe('chatStream reasoning_effort (HTTP direct path)', () => {
  it('sends reasoning_effort:"high" in the body when escalated', async () => {
    let sentBody: Record<string, unknown> = {};
    globalThis.fetch = (async (_url: string, init: { body: string }) => {
      sentBody = JSON.parse(init.body);
      return new Response('data: [DONE]\n\n', { status: 200 });
    }) as unknown as typeof fetch;
    await collect(chatStream({
      messages: [{ role: 'user', content: 'résous' }],
      promptCacheKey: 'test-v1',
      reasoningEffort: 'high',
    }));
    expect(sentBody['reasoning_effort']).toBe('high');
  });

  it('omits reasoning_effort when not escalated (none)', async () => {
    let sentBody: Record<string, unknown> = {};
    globalThis.fetch = (async (_url: string, init: { body: string }) => {
      sentBody = JSON.parse(init.body);
      return new Response('data: [DONE]\n\n', { status: 200 });
    }) as unknown as typeof fetch;
    await collect(chatStream({
      messages: [{ role: 'user', content: 'salut' }],
      promptCacheKey: 'test-v1',
      reasoningEffort: 'none',
    }));
    expect(sentBody['reasoning_effort']).toBeUndefined();
  });

  it('drops thinking chunks and keeps only answer text', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":[{"type":"thinking","thinking":[{"type":"text","text":"reflexion"}]},{"type":"text","text":"Reponse"}]}}]}',
      'data: [DONE]',
      '',
    ].join('\n');
    globalThis.fetch = (async () => new Response(sse, { status: 200 })) as unknown as typeof fetch;
    const chunks = await collect(chatStream({
      messages: [{ role: 'user', content: 'q' }],
      promptCacheKey: 'test-v1',
      reasoningEffort: 'high',
    }));
    const text = chunks.filter((c) => c.type === 'text').map((c) => c.text).join('');
    expect(text).toBe('Reponse');
  });
});
