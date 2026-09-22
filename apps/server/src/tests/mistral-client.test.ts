import './_helpers/mistral-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { generateText, generateStructured, type MistralMessage } from '../lib/ai/mistral-client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchJson(capture: { url?: string; body?: Record<string, unknown> }, responseBody: unknown) {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capture.url = String(url);
    capture.body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined;
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

function chatCompletion(content: string) {
  return {
    id: 'cmpl-1',
    object: 'chat.completion',
    created: 0,
    model: 'mistral-small-2603',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

describe('generateText', () => {
  it('returns the completion text', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion('Bonjour !'));

    const messages: MistralMessage[] = [
      { role: 'system', content: 'Tu es un tuteur.' },
      { role: 'user', content: 'Salut' },
    ];
    const text = await generateText({ functionId: 'test', messages, maxTokens: 128, temperature: 0.3 });

    expect(text).toBe('Bonjour !');
  });

  it('sends prompt_cache_key and max_tokens on the wire body', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion('ok'));

    await generateText({
      functionId: 'test',
      messages: [{ role: 'user', content: 'Salut' }],
      maxTokens: 256,
      promptCacheKey: 'test-cache-v1',
    });

    expect(capture.body?.['prompt_cache_key']).toBe('test-cache-v1');
    expect(capture.body?.['max_tokens']).toBe(256);
  });

  it('sends multimodal user content (text + image_url) on the wire body', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion('vu'));

    const messages: MistralMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Décris cette image' },
          { type: 'image_url', imageUrl: { url: 'data:image/png;base64,AAA' } },
        ],
      },
    ];
    await generateText({ functionId: 'test', messages });

    const sentMessages = capture.body?.['messages'] as Array<{ content: unknown }>;
    const userContent = sentMessages[0]?.content as Array<Record<string, unknown>>;
    expect(userContent.some((part) => part['type'] === 'text')).toBe(true);
    expect(userContent.some((part) => part['type'] === 'image_url')).toBe(true);
  });

  it('calls the dated model on the EU endpoint with reasoning off', async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion('ok'));

    await generateText({ functionId: 'test', messages: [{ role: 'user', content: 'Salut' }] });

    expect(capture.url).toBe('https://api.eu.mistral.ai/v1/chat/completions');
    expect(capture.body?.['model']).toBe('mistral-small-2603');
    expect(capture.body?.['reasoning_effort']).toBe('none');
  });
});

describe('generateStructured', () => {
  const schema = z.object({ intent: z.enum(['explain-concept', 'chit-chat']) });

  it('returns the validated object and the real usage', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion(JSON.stringify({ intent: 'explain-concept' })));

    const result = await generateStructured({ functionId: 'test', messages: [{ role: 'user', content: 'classe' }], schema, schemaName: 'intent' });

    expect(result).toEqual({ object: { intent: 'explain-concept' }, usage: { inputTokens: 10, outputTokens: 5 } });
    const responseFormat = capture.body?.['response_format'] as Record<string, unknown>;
    expect(responseFormat['type']).toBe('json_schema');
    const wire = responseFormat['json_schema'] as Record<string, unknown>;
    expect(wire['strict']).toBe(true);
    expect(wire['name']).toBe('intent');
  });

  it('turns strict json_schema off when asked', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion(JSON.stringify({ intent: 'explain-concept' })));

    await generateStructured({ functionId: 'test', messages: [{ role: 'user', content: 'classe' }], schema, schemaName: 'intent', strict: false });

    const responseFormat = capture.body?.['response_format'] as Record<string, unknown>;
    expect((responseFormat['json_schema'] as Record<string, unknown>)['strict']).toBe(false);
  });

  it('retries once with the validation error, then succeeds', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const replies = [JSON.stringify({ intent: 'nope' }), JSON.stringify({ intent: 'chit-chat' })];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(init?.body as string) as Record<string, unknown>);
      return new Response(JSON.stringify(chatCompletion(replies[bodies.length - 1] ?? '')), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const result = await generateStructured({ functionId: 'test', messages: [{ role: 'user', content: 'salut' }], schema, schemaName: 'intent' });

    expect(result.object).toEqual({ intent: 'chit-chat' });
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
    const retryMessages = bodies[1]?.['messages'] as Array<{ role: string; content: unknown }>;
    expect(JSON.stringify(retryMessages.at(-1)?.content)).toContain('schéma');
  });

  it('does not retry twice', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify(chatCompletion(JSON.stringify({ intent: 'nope' }))), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const rejection = await generateStructured({ functionId: 'test', messages: [{ role: 'user', content: 'x' }], schema, schemaName: 'intent' })
      .catch((error: unknown) => error);

    expect(NoObjectGeneratedError.isInstance(rejection)).toBe(true);
    expect(calls).toBe(2);
  });

  it('bounds the first call and the retry with one timeout', async () => {
    let calls = 0;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      const content = calls === 1 ? JSON.stringify({ intent: 'nope' }) : JSON.stringify({ intent: 'chit-chat' });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 150);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(init.signal?.reason as Error);
        });
      });
      return new Response(JSON.stringify(chatCompletion(content)), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const rejection = await generateStructured({ functionId: 'test', messages: [{ role: 'user', content: 'x' }], schema, schemaName: 'intent', timeoutMs: 250 })
      .catch((error: unknown) => error);

    expect(calls).toBe(2);
    expect(rejection).toBeInstanceOf(Error);
    expect(NoObjectGeneratedError.isInstance(rejection)).toBe(false);
  });

  it('sends prompt_cache_key on the wire body', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion(JSON.stringify({ intent: 'explain-concept' })));

    await generateStructured({ functionId: 'test', messages: [{ role: 'user', content: 'classe' }], schema, schemaName: 'intent', promptCacheKey: 'intent-v1' });

    expect(capture.body?.['prompt_cache_key']).toBe('intent-v1');
  });

  it('keeps reasoning off for structured outputs', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion(JSON.stringify({ intent: 'explain-concept' })));

    await generateStructured({ functionId: 'test', messages: [{ role: 'user', content: 'classe' }], schema, schemaName: 'intent' });

    expect(capture.body?.['reasoning_effort']).toBe('none');
  });
});
