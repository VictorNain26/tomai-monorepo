import { describe, expect, it, mock } from 'bun:test';
import { generateText } from 'ai';

// No key in the validated env: the provider must leave apiKey out so that
// @ai-sdk/mistral falls back to process.env.MISTRAL_API_KEY on its own.
mock.module('../platform/config/env', () => ({
  env: { MISTRAL_API_KEY: undefined, MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai' },
}));
process.env.MISTRAL_API_KEY = 'key-from-process-env';

const { mistralProvider } = await import('../platform/ai/provider');

describe('mistralProvider without a key in the validated env', () => {
  it('lets the SDK read the key from process.env', async () => {
    const seen: { authorization: string | null } = { authorization: null };
    const provider = mistralProvider(async (_url, init) => {
      seen.authorization = new Headers(init?.headers).get('authorization');
      return new Response(
        JSON.stringify({
          id: 'cmpl-1', object: 'chat.completion', created: 0, model: 'mistral-small-2603',
          choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    });

    await generateText({ model: provider('mistral-small-2603'), prompt: 'hi' });

    expect(seen.authorization).toBe('Bearer key-from-process-env');
  });
});
