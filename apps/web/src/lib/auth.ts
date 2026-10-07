/** better-auth's client, on the server's own origin (`/api/auth`), its session in a cookie. */

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

/** better-auth's error codes, in words a parent reads; the server's own message never shows. */
const AUTH_MESSAGES: Partial<Record<string, string>> = {
  INVALID_EMAIL_OR_PASSWORD: 'Adresse ou mot de passe incorrect.',
  EMAIL_NOT_VERIFIED: 'Confirmez d’abord votre adresse : un nouveau lien vient de vous être envoyé.',
  USER_ALREADY_EXISTS: 'Un compte existe déjà avec cette adresse.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Un compte existe déjà avec cette adresse.',
  PASSWORD_TOO_SHORT: 'Le mot de passe est trop court : 8 caractères au moins.',
  PASSWORD_TOO_LONG: 'Le mot de passe est trop long.',
  INVALID_TOKEN: 'Ce lien n’est plus valable. Demandez-en un nouveau.',
};

export function authMessage(error: { code?: string | undefined; status: number }): string {
  if (error.status === 429) return 'Trop d’essais. Patientez une minute avant de réessayer.';
  const message = error.code === undefined ? undefined : AUTH_MESSAGES[error.code];
  return message ?? 'Une erreur est survenue. Réessayez dans un instant.';
}
