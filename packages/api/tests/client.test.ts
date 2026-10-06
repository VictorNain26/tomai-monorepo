import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { ClientResponse } from 'hono/client';
import { getClient, resetClient, unwrap, type ApiError } from '../src/client';
import { initializeApi, resetApiConfig } from '../src/config';
import type { FieldError } from '../src/types';

function errorResponse(status: number, body: string): ClientResponse<unknown> {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } }) as unknown as ClientResponse<unknown>;
}

async function caught(response: ClientResponse<unknown>): Promise<ApiError> {
  return unwrap(response).then(
    () => {
      throw new Error('unwrap should have thrown');
    },
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
    const fields: FieldError[] = [{ location: 'json', path: 'schoolLevel', code: 'invalid_value', message: 'Niveau scolaire invalide' }];
    const err = await caught(errorResponse(400, JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Champ invalide', fields } })));

    expect(err.fields).toEqual(fields);
  });

  it('ignores fields that are not a list', async () => {
    const err = await caught(errorResponse(400, JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Champ invalide', fields: null } })));

    expect('fields' in err).toBe(false);
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

describe('getClient', () => {
  afterEach(() => {
    mock.restore();
    resetClient();
    resetApiConfig();
  });

  it('requests the server origin with the session cookie', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ status: 'healthy' }));
    initializeApi({ baseUrl: 'https://tom.example' });

    await getClient().health.$get();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [input, init] = fetchSpy.mock.calls[0] ?? [];
    expect(input).toBe('https://tom.example/health');
    expect(init).toMatchObject({ credentials: 'include' });
  });

  it('builds the URL of a route', () => {
    initializeApi({ baseUrl: 'https://tom.example' });

    expect(getClient().health.$url().href).toBe('https://tom.example/health');
  });

  it.each(['/', '', 'tom.example', 'localhost:3000', 'file:///app'])('refuses the base %p, which is not an absolute http(s) URL', (baseUrl) => {
    expect(() => {
      initializeApi({ baseUrl });
    }).toThrow('[API] baseUrl must be an absolute http(s) URL');
  });
});
