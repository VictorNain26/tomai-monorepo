/**
 * Better Auth Configuration - Production Ready
 * Configuration propre et flexible basée sur la configuration centralisée
 *
 * Plugins 2026:
 * - admin: Parent impersonation (Quick Switch) with parent-child verification
 * - username: Student login with username
 * - expo: Mobile app support
 */

import { betterAuth } from "better-auth";
import { username, openAPI, mcp, admin } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import { db } from "../db/connection";
import { user, session, account, verification } from "../db/schema";
import { env, envUtils } from "../config/environment.config";
import { logger } from "./observability";

// Validation des services requis pour l'authentification
envUtils.validateService('Better Auth', [
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL'
]);

if (envUtils.isProduction && !env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL is required for production authentication');
}

/**
 * Configuration des origins de confiance basée sur les variables d'environnement
 */
function getTrustedOrigins(): string[] {
  // Si TRUSTED_ORIGINS est défini en production, l'utiliser
  if (env.TRUSTED_ORIGINS && env.TRUSTED_ORIGINS.length > 0) {
    return env.TRUSTED_ORIGINS;
  }
  
  // Sinon, construire à partir des variables d'environnement connues
  const origins: string[] = [];
  
  // Ajouter BETTER_AUTH_URL si défini
  if (env.BETTER_AUTH_URL) {
    origins.push(env.BETTER_AUTH_URL);
  }
  
  // Ajouter FRONTEND_URL si défini
  if (env.FRONTEND_URL) {
    origins.push(env.FRONTEND_URL);
  }
  
  // Ajouter CORS_ORIGINS si défini
  if (env.CORS_ORIGINS) {
    origins.push(...env.CORS_ORIGINS);
  }
  
  // Origins de développement par défaut
  if (envUtils.isDevelopment) {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001'
    );
  }

  // Mobile app deep link schemes (Expo)
  origins.push(
    'tomia://',           // Production app scheme
    'exp://'              // Expo development
  );

  // Déduplication et filtrage
  return Array.from(new Set(origins)).filter(Boolean);
}

const trustedOrigins = getTrustedOrigins();

/**
 * Détermine le domaine cookie pour les sous-domaines
 * En production: ".tomia.fr" pour partager entre tomia.fr et api.tomia.fr
 * En développement: undefined (localhost)
 */
function getCookieDomain(): string | undefined {
  if (envUtils.isDevelopment) {
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
    } catch {
      // Fallback si URL invalide
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
  isProduction: envUtils.isProduction,
  cookieDomain,
  crossSubDomainCookies: envUtils.isProduction,
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
    crossSubDomainCookies: envUtils.isProduction ? {
      enabled: true,
      domain: cookieDomain // ".tomia.fr"
    } : undefined,

    defaultCookieAttributes: {
      // SameSite: "lax" suffit pour les sous-domaines du même domaine parent
      sameSite: "lax",
      secure: envUtils.isProduction,
      httpOnly: true,
      path: "/",
    },

    generateSessionToken: true,
    cookiePrefix: "",
    useSecureCookies: envUtils.isProduction,
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

  socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Better Auth gère automatiquement les callbacks
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
    username(),
    openAPI(),
    mcp({
      loginPage: "/sign-in"
    }),
    expo(),  // Mobile app support (deep links, secure storage)

    // Admin plugin for Quick Switch (parent impersonation)
    // Best Practice 2026: Built-in impersonation with custom authorization
    admin({
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