/**
 * Subscription Routes Helpers
 *
 * Shared utilities for subscription management routes.
 * Security: All routes must verify authenticated user === requested parentId
 */

import { db } from '../../db/connection.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

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
