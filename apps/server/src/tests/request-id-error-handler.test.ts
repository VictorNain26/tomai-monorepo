import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { z } from 'zod';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../lib/http';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));

const { handleError, handleNotFound } = await import('../middleware/error-handler.middleware');
const { AppError } = await import('../lib/errors');
const { validate } = await import('../lib/http');

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const app = new Hono<AppEnv>()
  .use(requestId())
  .get('/app-error', () => {
    throw new AppError('SESSION_NOT_FOUND');
  })
  .get('/crash', () => {
    throw new Error('connection string postgres://secret');
  })
  .get('/ok', (c) => c.json({ requestId: c.var.requestId }))
  .post('/json', validate('json', z.object({ a: z.number() })), (c) => c.json(c.req.valid('json')))
  .onError(handleError)
  .notFound(handleNotFound);

type Envelope = { error: { code: string; message: string }; requestId: string };

async function call(path: string, init?: RequestInit) {
  const res = await app.request(path, init);
  return { res, body: (await res.json()) as Envelope };
}

describe('request id + global error envelope', () => {
  it('maps an AppError to its status with a request id echoed in the header', async () => {
    const { res, body } = await call('/app-error');
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('SESSION_NOT_FOUND');
    expect(body.requestId).toMatch(UUID_V4);
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('hides internal messages of unknown errors behind INTERNAL_ERROR', async () => {
    const { res, body } = await call('/crash');
    expect(res.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(body.requestId).toMatch(UUID_V4);
  });

  it('answers a malformed JSON body with 400 and a request id', async () => {
    const { res, body } = await call('/json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad',
    });
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.requestId).toMatch(UUID_V4);
  });

  it('exposes the same id to handlers and to the response header', async () => {
    const res = await app.request('/ok');
    const body = (await res.json()) as { requestId: string };
    expect(body.requestId).toMatch(UUID_V4);
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });
});
