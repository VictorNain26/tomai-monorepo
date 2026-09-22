import { describe, expect, it } from 'bun:test';
import { generateText } from 'ai';
import type { MistralLanguageModelChatOptions } from '@ai-sdk/mistral';

// Sans clé, @ai-sdk/mistral jette LoadAPIKeyError avant le fetch faké ;
// env.ts lit process.env au chargement, d'où l'import dynamique.
process.env['MISTRAL_API_KEY'] ??= 'test-api-key';
const { mistralProvider } = await import('../lib/ai/provider.js');
const { env } = await import('../config/env.js');

function fakeMistralResponse() {
  return new Response(
    JSON.stringify({
      id: 'cmpl-1', object: 'chat.completion', created: 0, model: 'mistral-small-2603',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

async function captureRequest(mistral: MistralLanguageModelChatOptions) {
  const captured: { url?: string; body?: Record<string, unknown> } = {};
  const provider = mistralProvider(async (url, init) => {
    captured.url = String(url);
    captured.body = JSON.parse(init?.body as string) as Record<string, unknown>;
    return fakeMistralResponse();
  });
  await generateText({ model: provider(env.MISTRAL_MODEL), prompt: 'hi', providerOptions: { mistral } });
  return captured;
}

describe('mistralProvider', () => {
  it('targets the EU regional endpoint', async () => {
    const { url } = await captureRequest({});
    expect(url).toBe('https://api.eu.mistral.ai/v1/chat/completions');
  });

  it('sends prompt_cache_key from providerOptions', async () => {
    const { body } = await captureRequest({ promptCacheKey: 'session-42' });
    expect(body?.['prompt_cache_key']).toBe('session-42');
  });

  it('omits prompt_cache_key without a key', async () => {
    const { body } = await captureRequest({});
    expect(body && 'prompt_cache_key' in body).toBe(false);
  });

  it('sends reasoning_effort for mistral-small-2603', async () => {
    expect((await captureRequest({ reasoningEffort: 'high' })).body?.['reasoning_effort']).toBe('high');
    expect((await captureRequest({ reasoningEffort: 'none' })).body?.['reasoning_effort']).toBe('none');
  });
});
