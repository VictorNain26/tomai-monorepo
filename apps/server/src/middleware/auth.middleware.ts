/**
 * Authentication Middleware - Strict DB Validation
 * Force validation contre DB pour éviter sessions orphelines
 *
 * @see PROBLEME_SESSION_ORPHELINE_SOLUTION.md
 */

import { auth } from '../lib/auth';
import { logger } from '../lib/observability';
import { db } from '../db/connection';
import { user, session as sessionTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { ElysiaAuthenticatedUser } from '../types/index.js';

export interface AuthenticatedContext {
  user: ElysiaAuthenticatedUser;
  session: Record<string, unknown>;
}


/**
 * Middleware d'authentification avec validation DB stricte
 *
 * Features:
 * - ✅ Force DB validation (disableCookieCache: true)
 * - ✅ Vérifie existence user en DB
 * - ✅ Cleanup automatique sessions orphelines
 * - ✅ Flag shouldClearCookies pour cookie invalidation
 *
 * Performance: +20-50ms overhead (acceptable <1000 users)
 */
export const requireAuth = async (headers: Headers): Promise<
  | { readonly success: true; readonly user: ElysiaAuthenticatedUser; readonly session: Record<string, unknown> }
  | { readonly success: false; readonly _error: string; readonly status: 401 | 503; readonly shouldClearCookies: boolean }
> => {
  try {
    // ✅ CRITICAL: Force DB validation, disable cookie cache
    // Better Auth cookie cache peut retourner sessions supprimées de DB
    const session = await auth.api.getSession({
      headers,
      query: { disableCookieCache: true }  // Toujours valider contre DB
    });

    if (!session?.user) {
      return {
        success: false,
        _error: 'Unauthorized',
        status: 401,
        shouldClearCookies: false  // Session n'existe pas
      } as const;
    }

    // ✅ ADDITIONAL CHECK: Vérifier que user existe vraiment en DB
    // Cas: session existe mais user a été supprimé (orphaned session)
    const userExists = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (userExists.length === 0) {
      // User supprimé mais session existe encore → Orphaned session
      logger.warn('Orphaned session detected - user deleted', {
        operation: 'auth:orphaned-session',
        userId: session.user.id,
        sessionId: session.session.id,
        severity: 'medium' as const
      });

      // ✅ CLEANUP: Invalider la session en DB
      try {
        await db
          .delete(sessionTable)
          .where(eq(sessionTable.id, session.session.id));

        logger.info('Orphaned session cleaned up', {
          operation: 'auth:orphaned-session:cleanup',
          sessionId: session.session.id
        });
      } catch (cleanupError) {
        // Non-bloquant si cleanup échoue
        logger.error('Failed to cleanup orphaned session', {
          operation: 'auth:orphaned-session:cleanup-failed',
          _error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          severity: 'medium' as const
        });
      }

      return {
        success: false,
        _error: 'Session invalid - user deleted',
        status: 401,
        shouldClearCookies: true  // Forcer suppression cookies
      } as const;
    }

    return {
      success: true,
      user: session.user as ElysiaAuthenticatedUser,
      session: session.session
    } as const;
  } catch (error) {
    // Better Auth peut throw si : database down, network error, malformed cookie
    logger.error('Authentication middleware error', {
      operation: 'auth:middleware:error',
      _error: error instanceof Error ? error.message : String(error),
      severity: 'high' as const
    });

    return {
      success: false,
      _error: 'Authentication service error',
      status: 503, // Service Unavailable (pas 401 car ce n'est pas un problème d'auth)
      shouldClearCookies: false
    } as const;
  }
};

export const requireParentRole = async (headers: Headers): Promise<
  | { readonly success: true; readonly user: ElysiaAuthenticatedUser; readonly session: Record<string, unknown> }
  | { readonly success: false; readonly _error: string; readonly status: 401 | 403 | 503; readonly shouldClearCookies: boolean }
> => {
  const authResult = await requireAuth(headers);

  if (!authResult.success) {
    return authResult;
  }

  if (authResult.user.role !== 'parent') {
    return {
      success: false,
      _error: 'Parent role required',
      status: 403,
      shouldClearCookies: false  // Pas une session orpheline, juste un rôle invalide
    } as const;
  }

  return authResult;
};

