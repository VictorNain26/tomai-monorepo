/**
 * better-auth, on the one public origin of the API and the web: the session cookie stays on that
 * host. No cookieCache: a cached session would outlive a deleted account, or a password the
 * guardian changed, for its whole maxAge. A student signs in by username; the guardian picks it.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import type { Config } from '../../config';
import type { Db } from '../db/client';
import { account, session, user, verification } from './schema';

export function createAuth(db: Db, config: Pick<Config, 'publicUrl' | 'authSecret'>) {
  return betterAuth({
    baseURL: config.publicUrl,
    secret: config.authSecret,
    database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification } }),
    emailAndPassword: { enabled: true },
    // better-auth 1.7 skips its origin check when NODE_ENV is test (context/create-context.mjs):
    // on in every environment, the tests exercise the check production runs.
    advanced: { disableOriginCheck: false },
    plugins: [username({ immutableUsername: true })],
  });
}

export type Auth = ReturnType<typeof createAuth>;
