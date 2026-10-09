import { describe, expect, it } from 'bun:test';
import { APICallError } from 'ai';
import { chatMessage, isTurnStep, mathDelimited, textOf, toUIMessage, waitingText } from './chat';

const refused = (status: number, responseBody?: string) =>
  new APICallError({
    message: 'refused',
    url: '/api/sessions/s/messages',
    requestBodyValues: {},
    statusCode: status,
    ...(responseBody === undefined ? {} : { responseBody }),
  });

describe('chatMessage', () => {
  it('says each refusal of the server in French', () => {
    expect(chatMessage(refused(429, JSON.stringify({ code: 'QUOTA_EXCEEDED' })))).toStartWith('Le temps avec Tom est fini');
    expect(chatMessage(refused(409, JSON.stringify({ code: 'TURN_IN_PROGRESS' })))).toStartWith('Tom répond encore');
    expect(chatMessage(refused(429, JSON.stringify({ code: 'RATE_LIMITED' })))).toStartWith('Trop de messages');
    expect(chatMessage(refused(400, JSON.stringify({ code: 'INVALID_REQUEST' })))).toBe('Ton message est vide ou trop long.');
  });

  it('falls back for an unknown code, a body that is not a problem, or a failure of the stream', () => {
    const fallback = 'Tom n’a pas pu répondre. Réessaie dans un instant.';
    expect(chatMessage(refused(500, JSON.stringify({ code: 'INTERNAL_ERROR' })))).toBe(fallback);
    expect(chatMessage(refused(502, 'Bad Gateway'))).toBe(fallback);
    expect(chatMessage(refused(500))).toBe(fallback);
    expect(chatMessage(new Error('Tom n’a pas pu répondre. Réessaie dans un instant.'))).toBe(fallback);
    expect(chatMessage(new Error('an internal message'))).toBe(fallback);
  });
});

describe('toUIMessage and textOf', () => {
  it('shows the student as the user and Tom as the assistant, the text kept', () => {
    const student = toUIMessage({ id: 'm1', role: 'student', text: 'Je bloque', createdAt: '2026-10-07T18:00:00.000Z' });
    expect(student).toEqual({ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Je bloque' }] });
    expect(toUIMessage({ id: 'm2', role: 'tutor', text: 'Où ?', createdAt: '2026-10-07T18:00:01.000Z' }).role).toBe('assistant');
    expect(textOf(student)).toBe('Je bloque');
    expect(textOf(undefined)).toBe('');
  });
});

describe('waitingText', () => {
  it('says what Tom does while the student waits, the long draw of a new exercise included', () => {
    expect(waitingText(null)).toBe('Tom lit ton message…');
    expect(waitingText('reading')).toBe('Tom lit ton message…');
    expect(waitingText('exercise')).toBe('Tom prépare ton exercice, ça prend quelques secondes…');
    expect(waitingText('writing')).toBe('Tom écrit sa réponse…');
  });
});

describe('isTurnStep', () => {
  it('takes only a step the web knows: a value the server adds later shows nothing wrong', () => {
    expect(isTurnStep('exercise')).toBe(true);
    expect(isTurnStep('checking')).toBe(false);
    expect(isTurnStep('toString')).toBe(false);
    expect(isTurnStep(3)).toBe(false);
  });
});

describe('mathDelimited', () => {
  it('turns the LaTeX delimiters a model may write into the dollars the renderer reads', () => {
    expect(mathDelimited('Que vaut \\( \\frac{3}{4} \\) ?')).toBe('Que vaut $ \\frac{3}{4} $ ?');
    expect(mathDelimited('On pose\n\\[x^2 = 9\\]\ndonc')).toBe('On pose\n$$x^2 = 9$$\ndonc');
  });

  it('leaves dollars and plain text as they are', () => {
    expect(mathDelimited('Il reste $3x = 15$ et 20 €.')).toBe('Il reste $3x = 15$ et 20 €.');
  });
});
