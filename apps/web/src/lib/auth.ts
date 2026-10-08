/** better-auth's client, on the server's own origin (`/api/auth`), its session in a cookie. */

import { passkeyClient } from '@better-auth/passkey/client';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { DevicePairing } from 'tomai-server/contract';

// The server's device pairing, its endpoints inferred (https://better-auth.com/docs/concepts/plugins).
const devicePairing = { id: 'device-pairing', $InferServerPlugin: {} as DevicePairing } satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({ plugins: [devicePairing, emailOTPClient(), passkeyClient()] });

interface AuthError {
  code?: string | undefined;
  status: number;
}

/** better-auth's error codes, in words a parent reads; the server's own message never shows. */
const AUTH_MESSAGES: Partial<Record<string, string>> = {
  INVALID_EMAIL: 'Une adresse e-mail valide.',
  INVALID_OTP: 'Ce code ne correspond pas. Vérifiez-le, ou demandez-en un nouveau.',
  OTP_EXPIRED: 'Ce code a expiré : demandez-en un nouveau.',
  TOO_MANY_ATTEMPTS: 'Trop d’essais avec ce code : demandez-en un nouveau.',
  INVITATION_REQUIRED: 'Cette adresse n’a pas d’invitation, ou elle a expiré.',
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: 'Cet appareil a déjà une clé d’accès pour Tom.',
  PASSKEY_NOT_FOUND: 'Tom ne connaît plus cette clé d’accès : entrez avec un code reçu par e-mail.',
  AUTHENTICATION_FAILED: 'Cette clé d’accès n’a pas été reconnue : entrez avec un code reçu par e-mail.',
};

/**
 * The browser's window closed by the person, or left to time out (both a NotAllowedError, which
 * WebAuthn keeps alike), or a pending ceremony replaced by a new one: nothing to say.
 */
export const isCancelled = (error: AuthError) => hasCode(error, 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY') || hasCode(error, 'ERROR_CEREMONY_ABORTED');

/** Whether better-auth's error is this one: some of its errors carry no code. */
export const hasCode = (error: AuthError, code: string) => error.code === code;

export function authMessage(error: AuthError): string {
  if (error.status === 429) return 'Trop d’essais. Patientez une minute avant de réessayer.';
  const message = error.code === undefined ? undefined : AUTH_MESSAGES[error.code];
  return message ?? 'Une erreur est survenue. Réessayez dans un instant.';
}
