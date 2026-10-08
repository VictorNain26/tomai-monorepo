/**
 * Device pairing: a guardian's request yields a short code for one user; the device that sends it
 * gets its own session for that user, and the guardian holds no lasting credential of their child.
 * Whoever holds the code can redeem it, the guardian included: what protects the student is that
 * every paired device is a session they see in their own list. better-auth's one-time-token shares
 * an existing session and its device authorization gives the session to whoever approves: neither
 * opens one for another user. This plugin is made of better-auth's own parts: verification values
 * (single use, hashed by `storeIdentifier`), sessions, the signed session cookie and its
 * transactions. A device handed to a student keeps no guardian session: the multi-session plugin
 * switches to any session a device holds, so switching back asks for the guardian's code or passkey.
 */

import type { GenericEndpointContext } from '@better-auth/core';
import { runWithTransaction } from '@better-auth/core/context';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, createAuthMiddleware } from 'better-auth/api';
import { expireCookie, parseCookies, setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';
import type { Auth } from './auth';

export const PAIRING_PREFIX = 'device-pairing:';
const PAIRING_MINUTES = 10;
// Crockford's base32 (https://www.crockford.com/base32.html): no I, L, O or U to misread. Eight
// characters, 40 bits, single use for ten minutes behind a rate limit.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;

/** Uppercase, without spaces or dashes, and Crockford's decoding of the letters read as digits. */
export const normalisePairingCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

function generatePairingCode(): string {
  // 256 is a multiple of 32: every character is equally likely.
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

/** A student's address is the RFC 6761 `.invalid` one better-auth makes for an account without email. */
export const isStudentEmail = (email: string) => email.endsWith('.invalid');

/**
 * Deletes every guardian session the request's device holds: the active one, whose cookie the
 * student's replaces, and each the multi-session plugin keeps, whose cookie expires, as does one
 * whose session is gone (the active one shares its token).
 */
async function closeGuardianSessions(ctx: GenericEndpointContext) {
  const { sessionToken } = ctx.context.authCookies;
  for (const name of parseCookies(ctx.headers?.get('cookie') ?? '').keys()) {
    const active = name === sessionToken.name;
    if (!active && !name.startsWith(`${sessionToken.name}_multi-`)) continue;
    const token = await ctx.getSignedCookie(name, ctx.context.secret);
    const held = token ? await ctx.context.internalAdapter.findSession(token) : null;
    if (held && isStudentEmail(held.user.email)) continue;
    if (held) await ctx.context.internalAdapter.deleteSession(held.session.token);
    if (!active) expireCookie(ctx, { name, attributes: sessionToken.attributes });
  }
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
      /**
       * The device sends the code and gets a session of its own; the code is spent. A session of the
       * same student the device held, the multi-session plugin closes; a sibling's stays.
       */
      redeemPairingCode: createAuthEndpoint(
        '/device-pairing/redeem',
        { method: 'POST', body: z.object({ code: z.string().max(32) }) },
        async (ctx) => {
          const { internalAdapter } = ctx.context;
          const paired = await runWithTransaction(ctx.context.adapter, async () => {
            // consumeVerificationValue deletes the code and returns nothing once it has expired.
            const verification = await internalAdapter.consumeVerificationValue(`${PAIRING_PREFIX}${normalisePairingCode(ctx.body.code)}`);
            const user = verification ? await internalAdapter.findUserById(verification.value) : null;
            if (!user) return null;
            return { user, session: await internalAdapter.createSession(user.id) };
          });
          if (!paired) throw new APIError('BAD_REQUEST', { message: 'Invalid or expired code' });
          await closeGuardianSessions(ctx);
          await setSessionCookie(ctx, paired);
          return ctx.json({ user: { id: paired.user.id, name: paired.user.name } });
        },
      ),
    },
    hooks: {
      after: [
        {
          // A switch, or the guardian's own session revoked: the device goes to whichever is next.
          matcher: (ctx) => ctx.path === '/multi-session/set-active' || ctx.path === '/multi-session/revoke',
          handler: createAuthMiddleware(async (ctx) => {
            const active = ctx.context.newSession;
            if (active && isStudentEmail(active.user.email)) await closeGuardianSessions(ctx);
          }),
        },
      ],
    },
    // Keyed by the client's address, which better-auth reads behind the host's proxy once its
    // trusted hops are set (docs/suivi.md, preproduction step).
    rateLimit: [{ pathMatcher: (path: string) => path === '/device-pairing/redeem', window: 60, max: 5 }],
  } satisfies BetterAuthPlugin;
}
