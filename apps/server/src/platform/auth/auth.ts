/**
 * Better Auth Configuration - Production Ready
 * Configuration propre et flexible basée sur la configuration centralisée
 *
 * Plugins:
 * - openAPI: API documentation (development only)
 * - username: Autonomous child login
 */

import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { openAPI, username } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../../db/connection';
import { user, session, account, verification } from '../../db/schema';
import { env, isProduction, isDevelopment } from '../config/env';
import { logger } from '../observability/logger';

// Validation des services requis pour l'authentification
if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
  throw new Error('BETTER_AUTH_SECRET is required and must be at least 32 characters');
}
if (!env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL is required');
}

logger.info('Better Auth Configuration', {
  baseURL: env.BETTER_AUTH_URL,
  environment: env.NODE_ENV,
  operation: 'auth:config',
});

// One origin serves the API and the web client: the session cookie stays on that host.
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  // No cookieCache: a cached session outlives a deleted account for its whole maxAge.
  session: {
    expiresIn: env.SESSION_MAX_AGE,
    updateAge: env.SESSION_UPDATE_AGE,
  },

  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: isProduction(),
      httpOnly: true,
      path: '/',
    },

    generateSessionToken: true,
    cookiePrefix: '',
    useSecureCookies: isProduction(),
  },

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            prompt: 'select_account',
            // Google omits given_name and family_name for some accounts, whatever its types say.
            mapProfileToUser: (profile) => ({
              firstName: (profile.given_name as string | undefined) ?? null,
              lastName: (profile.family_name as string | undefined) ?? null,
            }),
          },
        }
      : {},

  user: {
    additionalFields: {
      firstName: {
        type: 'string',
        required: false,
      },
      lastName: {
        type: 'string',
        required: false,
      },
      // Written by the server only (createStudentAccount): a client could otherwise make itself
      // a parent through update-user, or store a level the enum refuses.
      role: {
        type: 'string',
        defaultValue: 'parent',
        input: false,
      },
      schoolLevel: {
        type: 'string',
        required: false,
        input: false,
      },
      dateOfBirth: {
        type: 'string',
        required: false,
      },
      isActive: {
        type: 'boolean',
        defaultValue: true,
      },
    },
  },

  plugins: [
    // openAPI only in development: it exposes the internal auth structure.
    // Typed as BetterAuthPlugin[] so this dev-only plugin doesn't leak its
    // (un-nameable) option types into `typeof auth` — which would break the
    // declaration emit of the public App type.
    ...(isDevelopment() ? ([openAPI()] as BetterAuthPlugin[]) : []),
    username(), // Autonomous child login: POST /api/auth/sign-in/username
  ],
});
