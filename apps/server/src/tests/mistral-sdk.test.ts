import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// A real server behind the real fetch: the SDK's timeout reaches it as it reaches Mistral.
type Reply = 'unavailable' | 'refused' | 'answer' | 'hang';
let replies: Reply[] = [];
let requests = 0;
const moderation = { id: 'm', model: 'mistral-moderation-2603', results: [{ categories: { selfharm: false }, categoryScores: { selfharm: 0.01 } }] };
const server = Bun.serve({
  port: 0,
  fetch: () => {
    requests++;
    const reply = replies.shift() ?? 'answer';
    if (reply === 'hang') return new Promise<Response>(() => {});
    if (reply === 'unavailable') return Response.json({ message: 'Service unavailable.' }, { status: 503 });
    if (reply === 'refused') return Response.json({ message: 'Bad request' }, { status: 400 });
    return Response.json(moderation);
  },
});

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/config/env', () => ({
  env: { MISTRAL_API_KEY: 'test-key', MISTRAL_TIMEOUT: 60_000, MISTRAL_SERVER_URL: server.url.origin },
}));

const { getMistralSdk } = await import('../platform/ai/mistral-sdk');

const moderate = (timeoutMs = 5_000) => getMistralSdk().classifiers.moderate({ model: 'mistral-moderation-2603', inputs: ['a'] }, { timeoutMs });

beforeEach(() => {
  requests = 0;
});
afterAll(async () => {
  await server.stop(true);
});

describe('getMistralSdk — retries', () => {
  it('retries a passing 503 and returns the answer', async () => {
    replies = ['unavailable', 'answer'];
    expect((await moderate()).results).toHaveLength(1);
    expect(requests).toBe(2);
  });

  it('does not retry a request the API refuses', async () => {
    replies = ['refused'];
    expect(await moderate().then(() => 'answered', () => 'failed')).toBe('failed');
    expect(requests).toBe(1);
  });

  it('fails a hung call at its timeout, in one attempt, whatever the timeout', async () => {
    replies = ['hang'];
    const start = Date.now();
    expect(await moderate(300).then(() => 'answered', () => 'failed')).toBe('failed');
    expect(requests).toBe(1);
    expect(Date.now() - start).toBeLessThan(1_000);
  });
});
