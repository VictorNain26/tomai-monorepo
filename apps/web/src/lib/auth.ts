/** better-auth's client, on the server's own origin (`/api/auth`), its session in a cookie. */

import type { BetterAuthClientPlugin } from 'better-auth/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { DevicePairing } from 'tomai-server/contract';

// The server's device pairing, its endpoints inferred (https://better-auth.com/docs/concepts/plugins).
const devicePairing = { id: 'device-pairing', $InferServerPlugin: {} as DevicePairing } satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({ plugins: [devicePairing, emailOTPClient()] });

/** better-auth's error codes, in words a parent reads; the server's own message never shows. */
const AUTH_MESSAGES: Partial<Record<string, string>> = {
  INVALID_EMAIL: 'Une adresse e-mail valide.',
  INVALID_OTP: 'Ce code ne correspond pas. Vérifiez-le, ou demandez-en un nouveau.',
  OTP_EXPIRED: 'Ce code a expiré : demandez-en un nouveau.',
  TOO_MANY_ATTEMPTS: 'Trop d’essais avec ce code : demandez-en un nouveau.',
  INVITATION_REQUIRED: 'Cette adresse n’a pas d’invitation, ou elle a expiré.',
};

export function authMessage(error: { code?: string | undefined; status: number }): string {
  if (error.status === 429) return 'Trop d’essais. Patientez une minute avant de réessayer.';
  const message = error.code === undefined ? undefined : AUTH_MESSAGES[error.code];
  return message ?? 'Une erreur est survenue. Réessayez dans un instant.';
}
