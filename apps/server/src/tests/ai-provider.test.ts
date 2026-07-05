import { describe, expect, it } from 'bun:test';
import { generateText } from 'ai';
import { mistralProvider } from '../lib/ai/provider.js';

function fakeMistralResponse() {
  return new Response(
    JSON.stringify({
      id: 'cmpl-1', object: 'chat.completion', created: 0, model: 'mistral-medium-latest',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

describe('mistralProvider', () => {
  it('injecte prompt_cache_key dans le body', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const provider = mistralProvider('chat-v12', async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return fakeMistralResponse();
    });
    await generateText({ model: provider('mistral-medium-latest'), prompt: 'hi' });
    expect(capturedBody?.prompt_cache_key).toBe('chat-v12');
  });

  it("n'injecte rien sans clé", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const provider = mistralProvider(undefined, async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return fakeMistralResponse();
    });
    await generateText({ model: provider('mistral-medium-latest'), prompt: 'hi' });
    expect(capturedBody && 'prompt_cache_key' in capturedBody).toBe(false);
  });
});
