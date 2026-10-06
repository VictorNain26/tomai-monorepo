import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import pino from 'pino';
import type { AppEnv } from './env';
import { notFound, Problem, problemHandler } from './problem';

const lines: string[] = [];
const logger = pino({ level: 'error' }, { write: (line: string) => lines.push(line) });

const app = new Hono<AppEnv>()
  .use(requestId())
  .get('/known', () => {
    throw new Problem('NOT_FOUND', 'Séance introuvable');
  })
  .get('/crash', () => {
    throw new Error('connection to db at 10.0.0.3 refused, user lea');
  })
  .onError(problemHandler(logger))
  .notFound(notFound);

describe('problem details', () => {
  it('answers a Problem with its status, as application/problem+json', async () => {
    const res = await app.request('/known');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toStartWith('application/problem+json');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ type: 'about:blank', title: 'Ressource introuvable', status: 404, code: 'NOT_FOUND', detail: 'Séance introuvable' });
    expect(body['requestId']).toBe(res.headers.get('x-request-id'));
  });

  it('answers an unknown route the same way', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe('NOT_FOUND');
  });

  it('answers an unexpected error with a bare 500, and logs it', async () => {
    const res = await app.request('/crash');
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('10.0.0.3');
    expect(JSON.parse(text)).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
    expect(JSON.parse(text)).not.toHaveProperty('detail');
    expect(lines.at(-1)).toContain('Unhandled error');
  });
});
