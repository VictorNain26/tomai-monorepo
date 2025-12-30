/**
 * Subscription Routes Helpers
 *
 * Shared utilities for subscription management routes.
 * Security: All routes must verify authenticated user === requested parentId
 */

import { db } from '../../db/connection.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { SubscriptionInfo } from '../../lib/stripe/index.js';
import { auth } from '../../lib/auth.js';

// User type from Better Auth session
interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

/**
 * Get authenticated user from request headers
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(
  headers: Headers
): Promise<AuthenticatedUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) {
    return null;
  }
  return session.user as AuthenticatedUser;
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

/**
 * Format subscription response
 */
export function formatSubscriptionResponse(
  info: SubscriptionInfo | null,
  plan: 'free' | 'premium'
) {
  if (!info) {
    return {
      plan,
      status: plan === 'free' ? 'active' : 'inactive',
      subscription: null,
    };
  }

  return {
    plan,
    status: info.status,
    subscription: {
      id: info.subscriptionId,
      status: info.status,
      currentPeriodStart: info.currentPeriodStart.toISOString(),
      currentPeriodEnd: info.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: info.cancelAtPeriodEnd,
      premiumChildrenCount: info.premiumChildrenCount,
      monthlyAmountCents: info.monthlyAmountCents,
      monthlyAmount: `${(info.monthlyAmountCents / 100).toFixed(2)}€`,
    },
  };
}

/**
 * Get Stripe subscription info for a parent
 */
export async function getStripeSubscription(parentId: string) {
  const { stripeService } = await import('../../lib/stripe/index.js');
  return stripeService.getSubscriptionStatus(parentId);
}

/**
 * Get premium plan ID
 */
export async function getPremiumPlanId(): Promise<string | null> {
  const { stripeService } = await import('../../lib/stripe/index.js');
  return stripeService.getPremiumPlanId();
}
