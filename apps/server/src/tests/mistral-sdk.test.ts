import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { mistralServer, outcome } from './_helpers/mistral-server';

const { server, state } = mistralServer();

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/config/env', () => ({
  env: { MISTRAL_API_KEY: 'test-key', MISTRAL_TIMEOUT: 60_000, MISTRAL_SERVER_URL: server.url.origin, MISTRAL_RETRY_ATTEMPTS: 3 },
}));

const { getMistralSdk, getModerationSdk, MODERATION_TIMEOUT_MS } = await import('../platform/ai/mistral-sdk');

const input = { model: 'mistral-moderation-2603', inputs: ['a'] };
const viaShared = (timeoutMs: number) => getMistralSdk().classifiers.moderate(input, { timeoutMs });
const viaModeration = () => getModerationSdk().classifiers.moderate(input, { timeoutMs: MODERATION_TIMEOUT_MS });

beforeEach(() => {
  state.requests = 0;
  state.replies = [];
});
afterAll(async () => {
  await server.stop(true);
});

describe('getMistralSdk — embeddings and voice', () => {
  it('retries a passing 503 and returns the answer', async () => {
    state.replies = ['unavailable', 'answer'];
    expect(await outcome(viaShared(5_000))).toMatchObject({ ended: 'answered' });
    expect(state.requests).toBe(2);
  });

  it('gives up on a lasting 503 once the 3 s window closes, with the 503', async () => {
    state.replies = Array<'unavailable'>(20).fill('unavailable');
    const { ended, ms } = await outcome(viaShared(60_000));
    expect(ended).toBe('SDKError');
    expect(ms).toBeLessThan(4_500);
    expect(state.requests).toBeGreaterThan(1);
  }, 10_000);

  it('fails a hung call at its timeout, at once: a timeout is not retried', async () => {
    state.replies = ['hang'];
    const { ended, ms } = await outcome(viaShared(300));
    expect(ended).toBe('RequestTimeoutError');
    // Retried, it would fail at once on each attempt until the 3 s window closes.
    expect(ms).toBeLessThan(2_000);
  });
});

describe('getModerationSdk — before every reply', () => {
  it('cuts a hung attempt and retries it, well within the budget', async () => {
    state.replies = ['hang', 'answer'];
    // Without a timeout per attempt, the hung one would run to the call's timeout and fail.
    expect((await outcome(viaModeration())).ended).toBe('answered');
    expect(state.requests).toBe(2);
  }, 10_000);

  it('fails a call hung on every attempt before its timeout', async () => {
    state.replies = Array<'hang'>(10).fill('hang');
    const { ended, ms } = await outcome(viaModeration());
    expect(ended).not.toBe('answered');
    expect(state.requests).toBeGreaterThan(1);
    expect(ms).toBeLessThan(MODERATION_TIMEOUT_MS);
  }, 10_000);
});
