/**
 * better-auth, on the one public origin of the API and the web: the session cookie stays on that
 * host. No cookieCache: a cached session would outlive a deleted account, or a password the
 * guardian revoked, for its whole maxAge. A student has no credential: their device is paired by
 * a guardian's code (./pairing.ts). A guardian proves their email before signing in, can reset
 * their password, which ends every session, and delete their account after an email confirmation.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Config } from '../../config';
import type { Db } from '../db/client';
import type { Mailer } from '../email/mailer';
import { devicePairing, PAIRING_PREFIX } from './pairing';
import { account, session, user, verification } from './schema';

interface AuthDeps {
  mailer: Mailer;
  /** Run before a user row goes: what the user's deletion takes with it. */
  beforeDeleteUser: (userId: string) => Promise<void>;
}

export function createAuth(db: Db, config: Pick<Config, 'publicUrl' | 'authSecret'>, { mailer, beforeDeleteUser }: AuthDeps) {
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
        sendDeleteAccountVerification: async ({ user: { email }, url }) => {
          await send({
            to: email,
            subject: 'Confirmer la suppression de votre compte Tom',
            text: `Bonjour,\n\nCe lien supprime votre compte, et avec lui votre foyer et les comptes de vos enfants si vous en êtes le seul parent :\n${url}\n\nSi vous n'avez rien demandé, ignorez ce message.`,
          });
        },
        beforeDelete: async ({ id }) => {
          await beforeDeleteUser(id);
        },
      },
    },
    // better-auth 1.7 skips its origin check when NODE_ENV is test (context/create-context.mjs):
    // on in every environment, the tests exercise the check production runs.
    advanced: { disableOriginCheck: false },
    // A pairing code is a credential: stored hashed, like a password, never in clear.
    verification: { storeIdentifier: { default: 'plain', overrides: { [PAIRING_PREFIX]: 'hashed' } } },
    plugins: [devicePairing()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
