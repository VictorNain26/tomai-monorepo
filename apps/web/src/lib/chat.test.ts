import { describe, expect, it } from 'bun:test';
import { APICallError } from 'ai';
import { chatMessage, problemCodeOf, textOf, toUIMessage } from './chat';

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

describe('problemCodeOf', () => {
  it('reads the code of a problem body, and nothing else', () => {
    expect(problemCodeOf(refused(401, JSON.stringify({ code: 'UNAUTHENTICATED' })))).toBe('UNAUTHENTICATED');
    expect(problemCodeOf(refused(400, JSON.stringify({ code: 7 })))).toBeNull();
    expect(problemCodeOf(new TypeError('Failed to fetch'))).toBeNull();
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
