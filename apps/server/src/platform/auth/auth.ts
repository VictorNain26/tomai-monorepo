/**
 * better-auth, on the one public origin of the API and the web: the session cookie stays on that
 * host. No cookieCache: a cached session would outlive a deleted account for its whole maxAge. A
 * student has no credential: their device is paired by a guardian's code (./pairing.ts). A
 * guardian has no password either: a code sent to their address lets them in, and the first one
 * creates their account, on an invitation (./invitation.ts), and a passkey then saves them the
 * code. Deleting the account, or adding a passkey, asks for a session opened a few minutes before.
 */

import type { GenericEndpointContext } from '@better-auth/core';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { emailOTP, multiSession } from 'better-auth/plugins';
import type { Logger } from 'pino';
import type { Config } from '../../config';
import type { Db } from '../db/client';
import type { Mailer } from '../email/mailer';
import { CLIENT_ADDRESS_HEADER } from '../http/client-address';
import { invitationIdentifier } from './invitation';
import { devicePairing, isStudentEmail, PAIRING_PREFIX } from './pairing';
import { account, passkey as passkeyTable, session, user, verification } from './schema';

interface AuthDeps {
  mailer: Mailer;
  logger: Logger;
  /** Runs a task after its request has answered: an email's timing tells nothing. */
  background: (task: Promise<unknown>) => void;
  /**
   * Deletes the user and what goes with them, in one transaction, before better-auth's own
   * deletion, which then finds nothing left: better-auth runs its steps outside a transaction.
   */
  deleteUser: (userId: string) => Promise<void>;
}

export function createAuth(db: Db, config: Pick<Config, 'publicUrl' | 'authSecret'>, { mailer, logger, background, deleteUser }: AuthDeps) {
  // A student's address is never sent to, and answered as an unknown address would be, without telling.
  const send: Mailer = async (email) => {
    if (isStudentEmail(email.to)) return;
    await mailer(email);
  };
  const { hostname: rpID, origin } = new URL(config.publicUrl);

  // Closed beta: an address without an account needs a live invitation, whatever creates the user.
  const invited = async ({ context }: GenericEndpointContext, email: string) => {
    const invitation = await context.internalAdapter.findVerificationValue(invitationIdentifier(email));
    return invitation !== null && invitation.expiresAt > new Date();
  };

  return betterAuth({
    baseURL: config.publicUrl,
    secret: config.authSecret,
    // Transactions on: better-auth's own multi-step writes (and device pairing) are atomic.
    database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification, passkey: passkeyTable }, transaction: true }),
    // better-auth's own messages, a failed email among them, go to pino; only an error's own
    // fields, through pino's serializer, never the other arguments, which can hold a user.
    logger: {
      log: (level, message, ...args) => {
        logger[level]({ err: args.find((arg) => arg instanceof Error) }, message);
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async ({ id }) => {
          await deleteUser(id);
        },
        afterDelete: ({ email }) => {
          const notice = send({
            to: email,
            subject: 'Votre compte Tom est supprimé',
            text: `Bonjour,\n\nVotre compte Tom est supprimé, et avec lui votre foyer et les comptes de vos enfants si vous en étiez le seul parent.\n\nSi vous n'avez rien demandé, écrivez-nous en répondant à ce message.`,
          });
          background(
            notice.catch((error: unknown) => {
              logger.error({ err: error }, 'Deletion notice not sent');
            }),
          );
          return Promise.resolve();
        },
      },
    },
    // A session lives ninety days without use, renewed as it is used: a summer without opening the
    // tablet leaves the child's device paired. Deleting the account, or adding a passkey, needs a
    // session at most ten minutes old.
    session: { expiresIn: 90 * 24 * 60 * 60, freshAge: 10 * 60 },
    databaseHooks: {
      user: {
        create: {
          // Every path that creates a guardian; a student is inserted by the household module.
          before: async ({ email }, ctx) => {
            if (!ctx || !(await invited(ctx, email))) {
              throw APIError.from('FORBIDDEN', { code: 'INVITATION_REQUIRED', message: 'Sign-up is by invitation only' });
            }
          },
          // Spent once the account exists, after the transaction commits (better-auth's db/with-hooks.mjs).
          after: async ({ email }, ctx) => {
            await ctx?.context.internalAdapter.deleteVerificationByIdentifier(invitationIdentifier(email));
          },
        },
      },
    },
    // A page of the web: better-auth's own error page has an inline style the CSP blocks.
    onAPIError: { errorURL: `${config.publicUrl}/erreur-connexion` },
    // better-auth 1.7 skips its origin check when NODE_ENV is test (context/create-context.mjs):
    // on in every environment, the tests exercise the check production runs.
    // The client's address, as the server reads it behind the host's proxy (app.ts).
    advanced: { disableOriginCheck: false, backgroundTasks: { handler: background }, ipAddress: { ipAddressHeaders: [CLIENT_ADDRESS_HEADER] } },
    // A pairing code is a credential: stored hashed, like a password, never in clear.
    verification: { storeIdentifier: { default: 'plain', overrides: { [PAIRING_PREFIX]: 'hashed' } } },
    // The code's own routes for what Tom does not use: no password to reset, no other check.
    disabledPaths: [
      '/email-otp/check-verification-otp',
      '/email-otp/verify-email',
      '/email-otp/request-password-reset',
      '/forget-password/email-otp',
      '/email-otp/reset-password',
    ],
    plugins: [
      devicePairing(),
      // A device keeps the child's session while their guardian enters on it (./pairing.ts hands
      // it back to the child).
      multiSession(),
      // Bound to the public origin, never to the one a request claims; a discoverable credential,
      // which the browser offers in the address field. Its name in Tom is the browser that made it,
      // as a session's: a name the client sends would also replace, in the browser's own list, the
      // guardian's address the passkey is filed under.
      passkey({
        rpID,
        rpName: 'Tom',
        origin,
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        registration: { afterVerification: ({ ctx }) => ({ name: ctx.headers?.get('user-agent') ?? 'Clé d’accès' }) },
      }),
      emailOTP({
        otpLength: 6,
        expiresIn: 5 * 60,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        // In the background (advanced.backgroundTasks): the answer is the same, and as fast, for any
        // address. One without an account or a live invitation is told of the closed beta instead.
        sendVerificationOTP: async ({ email, otp, type }, ctx) => {
          if (type !== 'sign-in' || !ctx) return;
          const known = (await ctx.context.internalAdapter.findUserByEmail(email)) !== null;
          if (known || (await invited(ctx, email))) {
            await send({
              to: email,
              subject: `Votre code Tom : ${otp}`,
              text: `Bonjour,\n\nVotre code pour entrer dans Tom : ${otp}\n\nIl est valable 5 minutes. Si vous n'avez rien demandé, ignorez ce message : personne n'entre sans ce code.`,
            });
            return;
          }
          await send({
            to: email,
            subject: 'Tom est en bêta fermée',
            text: `Bonjour,\n\nQuelqu'un, sans doute vous, a demandé à entrer dans Tom avec cette adresse. Tom est en bêta fermée : un compte ne se crée que sur invitation, et cette adresse n'en a pas, ou elle a expiré.\n\nSi vous attendiez une invitation, demandez-la à la personne qui vous a parlé de Tom. Sinon, ignorez ce message.`,
          });
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
