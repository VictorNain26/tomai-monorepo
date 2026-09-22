import './_helpers/mistral-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { mistralEmbeddingsService } from '../services/mistral-embeddings.service';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('mistralEmbeddingsService', () => {
  it('embeds with the dated model on the EU endpoint and normalises the vector', async () => {
    let request: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      request = input instanceof Request ? input : new Request(input, init);
      return new Response(
        JSON.stringify({
          id: 'e1', object: 'list', model: 'mistral-embed-2312',
          usage: { prompt_tokens: 1, total_tokens: 1 },
          data: [{ object: 'embedding', index: 0, embedding: [3, 4] }],
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const vector = await mistralEmbeddingsService.embed('bonjour');

    expect(request?.url).toBe('https://api.eu.mistral.ai/v1/embeddings');
    expect(((await request?.json()) as { model: string }).model).toBe('mistral-embed-2312');
    expect(vector).toEqual([0.6, 0.8]);
  });
});
