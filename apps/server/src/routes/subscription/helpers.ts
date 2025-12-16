/**
 * Subscription Routes Helpers
 *
 * Shared utilities for subscription management routes.
 */

import { db } from '../../db/connection.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { SubscriptionInfo } from '../../lib/stripe/index.js';

/**
 * Verify user is a parent (can manage subscriptions)
 */
export async function verifyParent(
  userId: string
): Promise<{ isParent: boolean; error?: string }> {
  const [userRecord] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userRecord) {
    return { isParent: false, error: 'User not found' };
  }

  if (userRecord.role !== 'parent') {
    return { isParent: false, error: 'Only parents can manage subscriptions' };
  }

  return { isParent: true };
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
