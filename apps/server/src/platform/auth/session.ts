import { auth } from './auth';
import { logger } from '../observability/logger';
import type { AuthenticatedUser } from '../../types/index.js';

export const requireAuth = async (headers: Headers): Promise<
  | { readonly success: true; readonly user: AuthenticatedUser; readonly session: Record<string, unknown> }
  | { readonly success: false; readonly _error: string; readonly status: 401 | 503 }
> => {
  try {
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      return { success: false, _error: 'Unauthorized', status: 401 } as const;
    }

    return {
      success: true,
      user: session.user as AuthenticatedUser,
      session: session.session,
    } as const;
  } catch (error) {
    logger.error('Authentication middleware error', {
      operation: 'auth:middleware:error',
      err: error,
      severity: 'high' as const,
    });

    return { success: false, _error: 'Authentication service error', status: 503 } as const;
  }
};

export const requireParentRole = async (headers: Headers): Promise<
  | { readonly success: true; readonly user: AuthenticatedUser; readonly session: Record<string, unknown> }
  | { readonly success: false; readonly _error: string; readonly status: 401 | 403 | 503 }
> => {
  const authResult = await requireAuth(headers);

  if (!authResult.success) {
    return authResult;
  }

  if (authResult.user.role !== 'parent') {
    return { success: false, _error: 'Parent role required', status: 403 } as const;
  }

  return authResult;
};
