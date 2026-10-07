import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { hc } from 'hono/client';
import { parseResponse } from './api';
import { householdMessage, isLevel, memoryStatus, newStudentSchema } from './household';

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
    expect(householdMessage(await failure('INVALID_REQUEST', 400))).toBe('Vérifiez ce que vous avez saisi.');
    expect(householdMessage(await failure('INVALID_REQUEST', 400), 'Votre enfant a entre 5 et 20 ans.')).toBe('Votre enfant a entre 5 et 20 ans.');
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
    expect(newStudentSchema.parse({ name: '  Léa ', level: 'sixieme', birthMonth: '2014-03', memoryProposed: true })).toEqual({
      name: 'Léa',
      level: 'sixieme',
      birthMonth: '2014-03',
      memoryProposed: true,
    });
  });

  it('refuses an empty name, no level, or a month out of the calendar', () => {
    expect(newStudentSchema.safeParse({ name: ' ', level: 'sixieme', birthMonth: '2014-03', memoryProposed: false }).success).toBe(false);
    expect(newStudentSchema.safeParse({ name: 'Léa', level: '', birthMonth: '2014-03', memoryProposed: false }).success).toBe(false);
    expect(newStudentSchema.safeParse({ name: 'Léa', level: 'sixieme', birthMonth: '2014-13', memoryProposed: false }).success).toBe(false);
  });
});

describe('memoryStatus', () => {
  const status = (memory: { proposed: boolean; state: 'off' | 'asked' | 'active'; decidesAlone: boolean }) => memoryStatus({ name: 'Léa', memory });

  it('says what the guardian has done and what the child answered, before 15', () => {
    expect(status({ proposed: false, state: 'off', decidesAlone: false })).toBe('Pas proposée : Tom ne retient rien d’une séance à l’autre.');
    expect(status({ proposed: true, state: 'asked', decidesAlone: false })).toBe('Proposée : Léa répondra à sa prochaine visite.');
    expect(status({ proposed: true, state: 'active', decidesAlone: false })).toStartWith('Léa l’a acceptée');
    expect(status({ proposed: true, state: 'off', decidesAlone: false })).toBe('Léa l’a refusée.');
  });

  it('from 15, says the child decides alone, and whether it is active', () => {
    expect(status({ proposed: false, state: 'asked', decidesAlone: true })).toBe('À partir de 15 ans, Léa décide seul : la question lui est posée.');
    expect(status({ proposed: false, state: 'off', decidesAlone: true })).toBe('À partir de 15 ans, Léa décide seul.');
    expect(status({ proposed: false, state: 'active', decidesAlone: true })).toStartWith('Léa l’a acceptée');
  });
});
