import { describe, expect, it } from 'bun:test';
import { APICallError } from 'ai';
import { Hono } from 'hono';
import { hc } from 'hono/client';
import { isProblem, parseResponse } from './api';

const app = new Hono()
  .get('/problem', (c) =>
    c.json({ type: 'about:blank', title: 'Connexion requise', status: 401, code: 'UNAUTHENTICATED' }, 401, {
      'Content-Type': 'application/problem+json',
    }),
  )
  .get('/text', (c) => c.text('Bad Gateway', 502));
const client = hc<typeof app>('http://localhost', { fetch: app.request });

const failure = (response: Parameters<typeof parseResponse>[0]) =>
  parseResponse(response).then(
    () => null,
    (error: unknown) => error,
  );

describe('isProblem', () => {
  it('reads the code of a problem body', async () => {
    const error = await failure(client.problem.$get());
    expect(isProblem(error, 'UNAUTHENTICATED')).toBe(true);
    expect(isProblem(error, 'QUOTA_EXCEEDED')).toBe(false);
  });

  it('is false for a failure without a problem body: text, or no answer at all', async () => {
    expect(isProblem(await failure(client.text.$get()), 'INTERNAL_ERROR')).toBe(false);
    expect(isProblem(new TypeError('Failed to fetch'), 'INTERNAL_ERROR')).toBe(false);
  });

  it('reads the code of a refused turn, which the chat transport carries as text', () => {
    const refused = (responseBody: string) =>
      new APICallError({ message: 'refused', url: '/api/sessions/s/messages', requestBodyValues: {}, statusCode: 429, responseBody });
    expect(isProblem(refused(JSON.stringify({ code: 'QUOTA_EXCEEDED' })), 'QUOTA_EXCEEDED')).toBe(true);
    expect(isProblem(refused(JSON.stringify({ code: 'QUOTA_EXCEEDED' })), 'RATE_LIMITED')).toBe(false);
    expect(isProblem(refused('Bad Gateway'), 'INTERNAL_ERROR')).toBe(false);
  });
});
