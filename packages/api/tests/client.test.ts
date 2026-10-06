import { describe, expect, it } from 'bun:test';
import type { ClientResponse } from 'hono/client';
import { unwrap, type ApiError } from '../src/client';

function errorResponse(status: number, body: string): ClientResponse<unknown> {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } }) as unknown as ClientResponse<unknown>;
}

async function caught(response: ClientResponse<unknown>): Promise<ApiError> {
  return unwrap(response).then(
    () => { throw new Error('unwrap should have thrown'); },
    (error: unknown) => error as ApiError,
  );
}

describe('unwrap error handling', () => {
  it('reads code and message from the { error: { code, message } } envelope', async () => {
    const err = await caught(errorResponse(400, JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Champ invalide' } })));

    expect(err.status).toBe(400);
    expect(err.message).toBe('Champ invalide');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect('fields' in err).toBe(false);
  });

  it('reads the fields of a VALIDATION_ERROR', async () => {
    const fields = [{ path: 'children.0.schoolLevel', code: 'invalid_value' }];
    const err = await caught(errorResponse(400, JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Champ invalide', fields } })));

    expect(err.fields).toEqual(fields);
  });

  it('falls back to the legacy { message, suggestions } body', async () => {
    const err = await caught(errorResponse(429, JSON.stringify({ message: 'Limite atteinte', suggestions: ['Réessayer demain'] })));

    expect(err.message).toBe('Limite atteinte');
    expect(err.suggestions).toEqual(['Réessayer demain']);
    expect('code' in err).toBe(false);
  });

  it('leaves code and suggestions out when the body is not JSON', async () => {
    const err = await caught(errorResponse(502, '<html>Bad Gateway</html>'));

    expect(err.message).toBe('HTTP 502');
    expect('code' in err).toBe(false);
    expect('suggestions' in err).toBe(false);
  });
});
