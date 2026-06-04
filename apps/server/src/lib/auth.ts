/**
 * Better Auth Configuration - Production Ready
 * Configuration propre et flexible basée sur la configuration centralisée
 *
 * Plugins:
 * - admin: Parent impersonation (Quick Switch) with parent-child verification
 * - expo: Mobile app support (deep links, secure storage)
 * - openAPI: API documentation
 * - mcp: Model Context Protocol
 */

import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { openAPI, mcp, admin } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import { db } from "../db/connection";
import { user, session, account, verification } from "../db/schema";
import { env, isProduction, isDevelopment, getTrustedOrigins } from "../config/env";
import { logger } from "./observability";

// Validation des services requis pour l'authentification
if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
  throw new Error('BETTER_AUTH_SECRET is required and must be at least 32 characters');
}
if (!env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL is required');
}

if (isProduction() && !env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL is required for production authentication');
}

const trustedOrigins = getTrustedOrigins();

/**
 * Détermine le domaine cookie pour les sous-domaines
 * En production: ".tomia.fr" pour partager entre tomia.fr et api.tomia.fr
 * En développement: undefined (localhost)
 */
function getCookieDomain(): string | undefined {
  if (isDevelopment()) {
    return undefined;
  }
  // Extraire le domaine parent depuis BETTER_AUTH_URL ou FRONTEND_URL
  // Ex: https://api.tomia.fr -> .tomia.fr
  const url = env.BETTER_AUTH_URL || env.FRONTEND_URL;
  if (url) {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        // Retourne .domaine.tld (ex: .tomia.fr)
        return '.' + parts.slice(-2).join('.');
      }
    } catch (error) {
      // URL invalide — fallback à undefined (localhost)
      logger.warn('Failed to extract cookie domain from URL', {
        operation: 'auth:cookie_domain:invalid_url',
        url: url ?? '(empty)',
        _error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return undefined;
}

const cookieDomain = getCookieDomain();

// Log de configuration
logger.info('Better Auth Configuration', {
  baseURL: env.BETTER_AUTH_URL,
  frontendURL: env.FRONTEND_URL,
  trustedOrigins,
  environment: env.NODE_ENV,
  isProduction: isProduction(),
  cookieDomain,
  crossSubDomainCookies: isProduction(),
  operation: 'auth:config'
});

// Configuration Better Auth - Architecture sous-domaines
// Frontend: app.tomia.fr | Backend: api.tomia.fr
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  // Origins de confiance pour les callbacks OAuth
  trustedOrigins,

  // Configuration des sessions
  session: {
    cookieCache: {
      enabled: true,
      maxAge: env.SESSION_MAX_AGE,
    },
    updateAge: env.SESSION_UPDATE_AGE,
  },

  // Configuration des cookies pour sous-domaines
  advanced: {
    // Cookies partagés entre sous-domaines (tomia.fr <-> api.tomia.fr)
    crossSubDomainCookies: isProduction() ? {
      enabled: true,
      domain: cookieDomain // ".tomia.fr"
    } : undefined,

    defaultCookieAttributes: {
      // SameSite: "lax" suffit pour les sous-domaines du même domaine parent
      sameSite: "lax",
      secure: isProduction(),
      httpOnly: true,
      path: "/",
    },

    generateSessionToken: true,
    cookiePrefix: "",
    useSecureCookies: isProduction(),
  },
  
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    }
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
      mapProfileToUser: (profile) => ({
        firstName: profile.given_name ?? null,
        lastName: profile.family_name ?? null,
      }),
    },
  } : {},


  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: false,
      },
      lastName: {
        type: "string",
        required: false,
      },
      role: {
        type: "string",
        defaultValue: "parent",
      },
      schoolLevel: {
        type: "string",
        required: false,
      },
      dateOfBirth: {
        type: "string",
        required: false,
      },
      parentId: {
        type: "string",
        required: false,
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
      },
      username: {
        type: "string",
        required: false,
      },
      displayUsername: {
        type: "string",
        required: false,
      },
    }
  },

  plugins: [
    // openAPI + mcp only in development (expose internal auth structure in prod = security risk).
    // Typed as BetterAuthPlugin[] so these dev-only plugins don't leak their
    // (un-nameable) option types into `typeof auth` — which would break the
    // declaration emit of the public App type. They add no client-consumed routes.
    ...(isDevelopment()
      ? ([openAPI(), mcp({ loginPage: "/sign-in" })] as BetterAuthPlugin[])
      : []),
    expo(),     // Mobile app support (deep links, secure storage)

    // Admin plugin for Quick Switch (parent impersonation)
    // Best Practice 2026: Built-in impersonation with custom authorization
    admin({
      // Default role for new users — must match user_role enum ('student' | 'parent' | 'admin')
      // Without this, admin plugin defaults to "user" which violates the PostgreSQL enum
      defaultRole: "parent",

      // Session duration: 7 days (same as normal sessions)
      impersonationSessionDuration: 7 * 24 * 60 * 60,

      // Don't allow impersonating other parents
      allowImpersonatingAdmins: false,

      // Custom authorization: Only parents can impersonate their own children
      // This hook runs BEFORE the impersonation happens
      async impersonationAllowed(ctx: {
        session?: { user: { id: string; role: string } };
        body?: { userId?: string };
      }) {
        const requestingUser = ctx.session?.user;
        const targetUserId = ctx.body?.userId;

        if (!requestingUser || !targetUserId) {
          logger.warn('Impersonation denied: missing user or target', {
            operation: 'auth:impersonation:denied',
            hasUser: !!requestingUser,
            hasTarget: !!targetUserId,
          });
          return false;
        }

        // Only parents can impersonate
        if (requestingUser.role !== 'parent') {
          logger.warn('Impersonation denied: user is not a parent', {
            operation: 'auth:impersonation:denied',
            userId: requestingUser.id,
            role: requestingUser.role,
          });
          return false;
        }

        // Verify target is a child of the requesting parent
        const [targetUser] = await db
          .select({ parentId: user.parentId, role: user.role })
          .from(user)
          .where(eq(user.id, targetUserId))
          .limit(1);

        if (!targetUser) {
          logger.warn('Impersonation denied: target user not found', {
            operation: 'auth:impersonation:denied',
            parentId: requestingUser.id,
            targetId: targetUserId,
          });
          return false;
        }

        // Target must be a student AND be the child of the requesting parent
        if (targetUser.role !== 'student' || targetUser.parentId !== requestingUser.id) {
          logger.warn('Impersonation denied: target is not child of parent', {
            operation: 'auth:impersonation:denied',
            parentId: requestingUser.id,
            targetId: targetUserId,
            targetRole: targetUser.role,
            targetParentId: targetUser.parentId,
          });
          return false;
        }

        logger.info('Impersonation allowed: parent switching to child', {
          operation: 'auth:impersonation:allowed',
          parentId: requestingUser.id,
          childId: targetUserId,
        });

        return true;
      },
    }),
  ],
});