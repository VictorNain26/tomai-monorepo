/**
 * Subscription Routes Helpers
 *
 * Shared utilities for subscription management routes.
 * Security: All routes must verify authenticated user === requested parentId
 */

import { db } from '../../db/connection.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.middleware.js';

// User type from Better Auth session
interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

/**
 * Get authenticated user from request headers with strict DB validation.
 * Delegates to requireAuth so orphan sessions (user deleted) are rejected and cleaned up.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser(
  headers: Headers
): Promise<AuthenticatedUser | null> {
  const authResult = await requireAuth(headers);
  if (!authResult.success) {
    return null;
  }
  return {
    id: authResult.user.id,
    email: authResult.user.email ?? '',
    name: authResult.user.name ?? '',
    role: authResult.user.role,
  };
}

/**
 * SECURE: Get authenticated parent from request
 * Verifies:
 * 1. User is authenticated
 * 2. User has role='parent'
 * 3. Returns the authenticated user (to use as parentId)
 */
export async function getAuthenticatedParent(
  headers: Headers
): Promise<{ parent: AuthenticatedUser | null; error?: string; status?: number }> {
  const authenticatedUser = await getAuthenticatedUser(headers);

  if (!authenticatedUser) {
    return { parent: null, error: 'Authentication required', status: 401 };
  }

  if (authenticatedUser.role !== 'parent') {
    return { parent: null, error: 'Only parents can manage subscriptions', status: 403 };
  }

  return { parent: authenticatedUser };
}

/**
 * SECURE: Verify authenticated user matches requested parentId
 * Prevents IDOR attacks by ensuring caller can only access their own data
 */
export function verifyParentIdMatch(
  authenticatedUserId: string,
  requestedParentId: string
): { valid: boolean; error?: string } {
  if (authenticatedUserId !== requestedParentId) {
    return {
      valid: false,
      error: 'Access denied: You can only manage your own subscription'
    };
  }
  return { valid: true };
}

/**
 * Get children IDs for a parent
 */
export async function getChildrenForParent(parentId: string): Promise<string[]> {
  const children = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.parentId, parentId));

  return children.map((c) => c.id);
}
