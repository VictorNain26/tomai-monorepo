import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import pino from 'pino';
import type { AppEnv } from './env';
import { notFound, problemHandler } from './problem';
import { rateLimit } from './rate-limit';

function app(points: number) {
  return new Hono<AppEnv>()
    .use(requestId())
    .use(rateLimit({ points, durationSeconds: 60 }))
    .get('/', (c) => c.text('ok'))
    .onError(problemHandler(pino({ level: 'silent' })))
    .notFound(notFound);
}

describe('rate limit', () => {
  it('lets a client through within its budget', async () => {
    const limited = app(2);
    expect((await limited.request('/')).status).toBe(200);
    expect((await limited.request('/')).status).toBe(200);
  });

  it('answers past the budget with a 429 problem and when to retry', async () => {
    const limited = app(1);
    await limited.request('/');
    const res = await limited.request('/');
    expect(res.status).toBe(429);
    expect(res.headers.get('content-type')).toStartWith('application/problem+json');
    expect(((await res.json()) as { code: string }).code).toBe('RATE_LIMITED');
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('ignores the forwarding headers a client can write', async () => {
    const limited = app(1);
    await limited.request('/', { headers: { 'X-Forwarded-For': '203.0.113.1', 'X-Real-IP': '203.0.113.1' } });
    const res = await limited.request('/', { headers: { 'X-Forwarded-For': '198.51.100.7', 'X-Real-IP': '198.51.100.7' } });
    expect(res.status).toBe(429);
  });
});
