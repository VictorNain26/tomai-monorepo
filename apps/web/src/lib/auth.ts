/** better-auth's client, on the server's own origin (`/api/auth`), its session in a cookie. */

import { queryOptions } from '@tanstack/react-query';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { createAuthClient } from 'better-auth/react';
import type { DevicePairing } from 'tomai-server/contract';

// The server's device pairing, its endpoints inferred (https://better-auth.com/docs/concepts/plugins).
const devicePairing = { id: 'device-pairing', $InferServerPlugin: {} as DevicePairing } satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({ plugins: [devicePairing] });

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

/** The sessions of whoever is signed in, one per paired device: what a student sees of their pairing. */
export const mySessionsQuery = queryOptions({
  queryKey: ['my-sessions'],
  queryFn: async () => {
    const { data, error } = await authClient.listSessions();
    if (error) throw new Error(`list-sessions failed: ${String(error.status)}`);
    return data;
  },
});
