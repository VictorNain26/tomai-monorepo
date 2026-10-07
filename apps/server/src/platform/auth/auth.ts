/**
 * better-auth, on the one public origin of the API and the web: the session cookie stays on that
 * host. No cookieCache: a cached session would outlive a deleted account, or a password the
 * guardian revoked, for its whole maxAge. A student has no credential: their device is paired by
 * a guardian's code (./pairing.ts). A guardian proves their email before signing in, can reset
 * their password, which ends every session, and delete their account by giving their password.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { Logger } from 'pino';
import type { Config } from '../../config';
import type { Db } from '../db/client';
import type { Mailer } from '../email/mailer';
import { devicePairing, PAIRING_PREFIX } from './pairing';
import { account, session, user, verification } from './schema';

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
  // A student's address is the RFC 6761 `.invalid` one better-auth makes for an account without
  // email: never sent to, and answered as an unknown address would be, without telling.
  const send: Mailer = async (email) => {
    if (email.to.endsWith('.invalid')) return;
    await mailer(email);
  };

  return betterAuth({
    baseURL: config.publicUrl,
    secret: config.authSecret,
    // Transactions on: better-auth's own multi-step writes (and device pairing) are atomic.
    database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification }, transaction: true }),
    // better-auth's own messages, a failed email among them, go to pino; only an error's own
    // fields, through pino's serializer, never the other arguments, which can hold a user.
    logger: {
      log: (level, message, ...args) => {
        logger[level]({ err: args.find((arg) => arg instanceof Error) }, message);
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user: { email }, url }) => {
        await send({
          to: email,
          subject: 'Réinitialiser votre mot de passe Tom',
          text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien, valable une heure :\n${url}\n\nToutes vos connexions seront fermées. Si vous n'avez rien demandé, ignorez ce message.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // A link that expired is sent again at the next sign-in attempt.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user: { email }, url }) => {
        await send({
          to: email,
          subject: 'Confirmez votre adresse e-mail',
          text: `Bonjour,\n\nPour activer votre compte Tom, confirmez votre adresse en ouvrant ce lien :\n${url}\n\nSi vous n'avez pas créé de compte, ignorez ce message.`,
        });
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
    hooks: {
      // Deleting an account asks for its password, whatever the session's age: a re-authentication
      // that works from any device, where an emailed link needs the browser that holds the session.
      before: createAuthMiddleware(async (ctx) => {
        const body: unknown = ctx.body;
        const password = typeof body === 'object' && body !== null && 'password' in body ? body.password : undefined;
        if (ctx.path === '/delete-user' && (typeof password !== 'string' || password === '')) {
          throw new APIError('BAD_REQUEST', { message: 'Password required' });
        }
        return Promise.resolve();
      }),
    },
    // better-auth 1.7 skips its origin check when NODE_ENV is test (context/create-context.mjs):
    // on in every environment, the tests exercise the check production runs.
    advanced: { disableOriginCheck: false, backgroundTasks: { handler: background } },
    // A pairing code is a credential: stored hashed, like a password, never in clear.
    verification: { storeIdentifier: { default: 'plain', overrides: { [PAIRING_PREFIX]: 'hashed' } } },
    plugins: [devicePairing()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
