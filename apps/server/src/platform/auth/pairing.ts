/**
 * Device pairing: a guardian's request yields a short code for one user; the device that sends it
 * gets its own session for that user, and the guardian never holds a credential of their child.
 * better-auth's one-time-token shares an existing session and its device authorization gives the
 * session to whoever approves: neither opens one for another user. This plugin is made of
 * better-auth's own parts: verification values (single use, hashed by `storeIdentifier`), sessions
 * and the signed session cookie.
 */

import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';
import type { Auth } from './auth';

export const PAIRING_PREFIX = 'device-pairing:';
const PAIRING_MINUTES = 10;
// Crockford's base32: no I, L, O or U to misread. Eight characters, 40 bits, single use for ten
// minutes behind a rate limit.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;

/** Uppercase, without the spaces and dashes a person types or a display adds. */
const normalise = (code: string) => code.toUpperCase().replace(/[\s-]/g, '');

function generatePairingCode(): string {
  // 256 is a multiple of 32: every character is equally likely.
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

/** A code that opens a session for `userId` on the device that sends it, within ten minutes. */
export async function createPairingCode(auth: Auth, userId: string) {
  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_MINUTES * 60_000);
  await (await auth.$context).internalAdapter.createVerificationValue({ identifier: `${PAIRING_PREFIX}${code}`, value: userId, expiresAt });
  return { code, expiresAt };
}

export function devicePairing() {
  return {
    id: 'device-pairing',
    endpoints: {
      /** The device sends the code and gets a session of its own; the code is spent. */
      redeemPairingCode: createAuthEndpoint(
        '/device-pairing/redeem',
        { method: 'POST', body: z.object({ code: z.string().max(32) }) },
        async (ctx) => {
          const verification = await ctx.context.internalAdapter.consumeVerificationValue(`${PAIRING_PREFIX}${normalise(ctx.body.code)}`);
          // consumeVerificationValue deletes the code and returns nothing once it has expired.
          const user = verification ? await ctx.context.internalAdapter.findUserById(verification.value) : null;
          if (!user) throw new APIError('BAD_REQUEST', { message: 'Invalid or expired code' });
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ user: { id: user.id, name: user.name } });
        },
      ),
    },
    rateLimit: [{ pathMatcher: (path: string) => path === '/device-pairing/redeem', window: 60, max: 5 }],
  } satisfies BetterAuthPlugin;
}
