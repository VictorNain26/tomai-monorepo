import { describe, it, expect, afterAll, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { mistralServer, outcome } from './_helpers/mistral-server';

const { server, state } = mistralServer();

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/config/env', () => ({
  env: { MISTRAL_API_KEY: 'test-key', MISTRAL_TIMEOUT: 60_000, MISTRAL_SERVER_URL: server.url.origin, MISTRAL_RETRY_ATTEMPTS: 0 },
}));

const { getMistralSdk, getModerationSdk, MODERATION_TIMEOUT_MS } = await import('../platform/ai/mistral-sdk');

afterAll(async () => {
  await server.stop(true);
});

describe('MISTRAL_RETRY_ATTEMPTS=0', () => {
  it('retries nothing, as for the AI SDK calls', async () => {
    const input = { model: 'mistral-moderation-2603', inputs: ['a'] };
    state.replies = ['unavailable', 'unavailable'];
    expect((await outcome(getMistralSdk().classifiers.moderate(input))).ended).toBe('SDKError');
    expect((await outcome(getModerationSdk().classifiers.moderate(input, { timeoutMs: MODERATION_TIMEOUT_MS }))).ended).toBe('SDKError');
    expect(state.requests).toBe(2);
  });
});
