import { describe, it, expect, mock, spyOn, afterEach } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));
mock.module('../config/env', () => ({
  env: {
    MISTRAL_API_KEY: 'test-key',
    MISTRAL_EMBED_MODEL: 'mistral-embed-2312',
    MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',
    MISTRAL_TIMEOUT: 50,
  },
}));

const { mistralEmbeddingsService } = await import('../services/mistral-embeddings.service');

afterEach(() => mock.restore());

describe('mistralEmbeddingsService timeout', () => {
  it('aborts the underlying HTTP request when the timeout elapses', async () => {
    let captured: AbortSignal | undefined;
    spyOn(globalThis, 'fetch').mockImplementation(((input: Request) => {
      captured = input.signal;
      return new Promise((_, reject) => {
        input.signal.addEventListener('abort', () => reject(input.signal.reason));
      });
    }) as unknown as typeof fetch);

    // eslint-disable-next-line @typescript-eslint/await-thenable -- bun:test .rejects.toThrow() is not typed as Promise but is awaitable
    await expect(mistralEmbeddingsService.embed('bonjour')).rejects.toThrow();
    expect(captured?.aborted).toBe(true);
  });
});
