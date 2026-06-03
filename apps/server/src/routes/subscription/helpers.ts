/**
 * Subscription Routes Helpers
 *
 * Shared utilities for subscription management routes.
 * Security: All routes must verify authenticated user === requested parentId
 */

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
