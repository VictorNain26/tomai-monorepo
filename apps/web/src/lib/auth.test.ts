import { describe, expect, it } from 'bun:test';
import { authMessage } from './auth';

const FALLBACK = 'Une erreur est survenue. Réessayez dans un instant.';

describe('authMessage', () => {
  it('says a known code in French', () => {
    expect(authMessage({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 })).toBe('Adresse ou mot de passe incorrect.');
  });

  it('asks to wait on a rate limit, whatever the code', () => {
    expect(authMessage({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 429 })).toStartWith('Trop d’essais.');
  });

  it('falls back for an unknown, empty or missing code, never showing the server’s', () => {
    expect(authMessage({ code: 'SOMETHING_NEW', status: 400 })).toBe(FALLBACK);
    expect(authMessage({ code: '', status: 400 })).toBe(FALLBACK);
    expect(authMessage({ status: 500 })).toBe(FALLBACK);
  });
});
