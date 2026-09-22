import './_helpers/mistral-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { generateCards, isGenerationError } from '../services/learning/card-generator.service';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const params = { topic: 'Pythagore', subject: 'mathematiques', level: 'quatrieme', cardCount: 1 } as const;

function completion(content: string) {
  return {
    id: 'c', object: 'chat.completion', created: 0, model: 'mistral-small-2603',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
  };
}

describe('generateCards', () => {
  it('reports the real token usage from the API', async () => {
    const cards = { cards: [{ cardType: 'flashcard', content: { front: 'a² + b² ?', back: 'c²' } }] };
    globalThis.fetch = (async () => new Response(JSON.stringify(completion(JSON.stringify(cards))), {
      status: 200, headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

    const result = await generateCards(params);

    if (isGenerationError(result)) throw new Error(result.error);
    expect(result.tokensUsed).toBe(140);
  });

  it('does not retry a non-retryable 400', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ message: 'bad request' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;

    const result = await generateCards(params);

    expect(isGenerationError(result)).toBe(true);
    expect(calls).toBe(1);
  }, 15_000);
});
