import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { hc } from 'hono/client';
import { parseResponse } from './api';
import { householdMessage, isLevel, newStudentSchema } from './household';

const problem = (code: string, status: 400 | 404 | 429 | 500) =>
  new Hono().get('/', (c) => c.json({ status, code }, status, { 'Content-Type': 'application/problem+json' }));

const failure = async (code: string, status: 400 | 404 | 429 | 500) => {
  const app = problem(code, status);
  return parseResponse(hc<typeof app>('http://localhost', { fetch: app.request }).index.$get()).then(
    () => null,
    (error: unknown) => error,
  );
};

describe('householdMessage', () => {
  it('says what to fix for each problem, in French', async () => {
    expect(householdMessage(await failure('INVALID_REQUEST', 400))).toStartWith('Vérifiez le prénom');
    expect(householdMessage(await failure('NOT_FOUND', 404))).toStartWith('Cet enfant ou cet appareil');
    expect(householdMessage(await failure('RATE_LIMITED', 429))).toStartWith('Trop d’essais');
  });

  it('falls back for any other failure, the network included', async () => {
    expect(householdMessage(await failure('INTERNAL_ERROR', 500))).toBe('Une erreur est survenue. Réessayez dans un instant.');
    expect(householdMessage(new TypeError('Failed to fetch'))).toBe('Une erreur est survenue. Réessayez dans un instant.');
  });
});

describe('isLevel', () => {
  it('takes the server’s levels only', () => {
    expect(isLevel('cinquieme')).toBe(true);
    expect(isLevel('seconde')).toBe(false);
    expect(isLevel('toString')).toBe(false);
    expect(isLevel(undefined)).toBe(false);
  });
});

describe('newStudentSchema', () => {
  it('takes a trimmed first name, a level and a month', () => {
    expect(newStudentSchema.parse({ name: '  Léa ', level: 'sixieme', birthMonth: '2014-03' })).toEqual({
      name: 'Léa',
      level: 'sixieme',
      birthMonth: '2014-03',
    });
  });

  it('refuses an empty name, no level, or a month out of the calendar', () => {
    expect(newStudentSchema.safeParse({ name: ' ', level: 'sixieme', birthMonth: '2014-03' }).success).toBe(false);
    expect(newStudentSchema.safeParse({ name: 'Léa', level: '', birthMonth: '2014-03' }).success).toBe(false);
    expect(newStudentSchema.safeParse({ name: 'Léa', level: 'sixieme', birthMonth: '2014-13' }).success).toBe(false);
  });
});
