import './_helpers/mistral-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { generateText, generateStructured, type MistralMessage } from '../lib/ai/mistral-client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchJson(capture: { body?: Record<string, unknown> }, responseBody: unknown) {
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
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
    model: 'mistral-medium-latest',
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
    const text = await generateText({ messages, maxTokens: 128, temperature: 0.3 });

    expect(text).toBe('Bonjour !');
  });

  it('sends prompt_cache_key and max_tokens on the wire body', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion('ok'));

    await generateText({
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
    await generateText({ messages });

    const sentMessages = capture.body?.['messages'] as Array<{ content: unknown }>;
    const userContent = sentMessages[0]?.content as Array<Record<string, unknown>>;
    expect(userContent.some((part) => part['type'] === 'text')).toBe(true);
    expect(userContent.some((part) => part['type'] === 'image_url')).toBe(true);
  });
});

describe('generateStructured', () => {
  const SCHEMA = {
    name: 'test_schema',
    strict: true,
    schema: {
      type: 'object',
      properties: { intent: { type: 'string' } },
      required: ['intent'],
      additionalProperties: false,
    },
  };

  it('returns the parsed object matching the schema', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion(JSON.stringify({ intent: 'explain-concept' })));

    const result = await generateStructured<{ intent: string }>({
      messages: [{ role: 'user', content: 'classe ce message' }],
      schema: SCHEMA,
    });

    expect(result).toEqual({ intent: 'explain-concept' });
  });

  it('sends response_format json_schema strict on the wire body', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion(JSON.stringify({ intent: 'explain-concept' })));

    await generateStructured<{ intent: string }>({
      messages: [{ role: 'user', content: 'classe' }],
      schema: SCHEMA,
      promptCacheKey: 'intent-v1',
    });

    const responseFormat = capture.body?.['response_format'] as Record<string, unknown>;
    expect(responseFormat?.['type']).toBe('json_schema');
    const jsonSchemaWire = responseFormat?.['json_schema'] as Record<string, unknown>;
    expect(jsonSchemaWire?.['strict']).toBe(true);
    expect(jsonSchemaWire?.['name']).toBe('test_schema');
    expect(capture.body?.['prompt_cache_key']).toBe('intent-v1');
  });
});
