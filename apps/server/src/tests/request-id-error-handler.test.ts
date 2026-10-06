import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { z } from 'zod';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

const { handleError, handleNotFound } = await import('../platform/http/error-handler');
const { AppError } = await import('../platform/http/errors');
const { validate } = await import('../platform/http/context');

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const app = new Hono<AppEnv>()
  .use(requestId({ headerName: '' }))
  .use(async (c, next) => {
    c.header('X-Request-Id', c.var.requestId);
    await next();
  })
  .get('/app-error', () => {
    throw new AppError('SESSION_NOT_FOUND');
  })
  .get('/crash', () => {
    throw new Error('connection string postgres://secret');
  })
  .get('/ok', (c) => c.json({ requestId: c.var.requestId }))
  .post('/json', validate('json', z.object({ a: z.number(), items: z.array(z.object({ name: z.string().min(1) })).optional() })), (c) =>
    c.json(c.req.valid('json')),
  )
  .post(
    '/strict/:id',
    validate('param', z.object({ id: z.uuid() })),
    validate(
      'json',
      z.strictObject({ name: z.string().optional() }).refine((body) => body.name !== undefined, 'Au moins un champ à modifier'),
    ),
    (c) => c.json(c.req.valid('json')),
  )
  .onError(handleError)
  .notFound(handleNotFound);

interface Envelope {
  error: { code: string; message: string; fields?: { location: string; path: string; code: string; message: string }[] };
  requestId: string;
}

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

  it('names each invalid field with its location, path, code and a French message, never the value', async () => {
    const { res, body } = await call('/json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 'secret-value', items: [{ name: 'ok' }, { name: '' }] }),
    });

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Les données envoyées sont invalides.');
    expect(body.error.fields?.map(({ location, path, code }) => ({ location, path, code }))).toEqual([
      { location: 'json', path: 'a', code: 'invalid_type' },
      { location: 'json', path: 'items.1.name', code: 'too_small' },
    ]);
    expect(body.error.fields?.[0]?.message).toStartWith('Entrée invalide');
    expect(JSON.stringify(body)).not.toContain('secret-value');
  });

  it('names each unknown key, beside the rule on the whole body', async () => {
    const { body } = await call(`/strict/${crypto.randomUUID()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ extra: 1 }),
    });

    expect(body.error.fields).toEqual([
      { location: 'json', path: 'extra', code: 'unrecognized_keys', message: 'Clé non reconnue : "extra"' },
      { location: 'json', path: '', code: 'custom', message: 'Au moins un champ à modifier' },
    ]);
  });

  it('keeps the schema message of a rule on the whole body', async () => {
    const { body } = await call(`/strict/${crypto.randomUUID()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(body.error.fields).toEqual([{ location: 'json', path: '', code: 'custom', message: 'Au moins un champ à modifier' }]);
  });

  it('tells a route parameter from a body field, and logs the fields', async () => {
    mockLogger.warn.mockClear();
    const { body } = await call('/strict/not-a-uuid', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });

    expect(body.error.fields?.map(({ location, path }) => ({ location, path }))).toEqual([{ location: 'param', path: 'id' }]);
    expect(JSON.stringify(mockLogger.warn.mock.calls)).toContain('"location":"param"');
  });

  it('leaves the fields out of an error that is not about the request body', async () => {
    const { body } = await call('/app-error');
    expect('fields' in body.error).toBe(false);
  });

  it('rejects a json body sent without a JSON Content-Type instead of validating {}', async () => {
    const { res, body } = await call('/json', { method: 'POST', body: '{"a":1}' });
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('ignores a client-supplied X-Request-Id', async () => {
    const res = await app.request('/ok', { headers: { 'X-Request-Id': 'forged-id' } });
    const body = (await res.json()) as { requestId: string };
    expect(body.requestId).toMatch(UUID_V4);
  });

  it('exposes the same id to handlers and to the response header', async () => {
    const res = await app.request('/ok');
    const body = (await res.json()) as { requestId: string };
    expect(body.requestId).toMatch(UUID_V4);
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });
});
