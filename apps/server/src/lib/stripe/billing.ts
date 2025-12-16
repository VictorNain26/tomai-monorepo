/**
 * Stripe Billing - Database Operations
 *
 * Handles family_billing table operations for subscription management.
 */

import { db } from '../../db/connection';
import { familyBilling } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { FamilyBillingRecord } from './types';
import { BILLING_STATUS } from './helpers';

/**
 * Get billing record for a parent
 */
export async function getBilling(parentId: string): Promise<FamilyBillingRecord | null> {
  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.parentId, parentId))
    .limit(1);
  return billing ?? null;
}

/**
 * Set billing status to active
 */
export async function setBillingActive(parentId: string): Promise<void> {
  await db
    .update(familyBilling)
    .set({ billingStatus: BILLING_STATUS.ACTIVE, updatedAt: new Date() })
    .where(eq(familyBilling.parentId, parentId));
}

/**
 * Set billing status to canceled
 */
export async function setBillingCanceled(parentId: string): Promise<void> {
  await db
    .update(familyBilling)
    .set({ billingStatus: BILLING_STATUS.CANCELED, updatedAt: new Date() })
    .where(eq(familyBilling.parentId, parentId));
}

/**
 * Clear billing subscription (expired/canceled)
 */
export async function clearBillingSubscription(parentId: string): Promise<void> {
  await db
    .update(familyBilling)
    .set({
      stripeSubscriptionId: null,
      premiumChildrenCount: 0,
      monthlyAmountCents: 0,
      billingStatus: BILLING_STATUS.EXPIRED,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));
}

/**
 * Update billing subscription with new children count and amount
 */
export async function updateBillingSubscription(
  parentId: string,
  data: { premiumChildrenCount: number; monthlyAmountCents: number }
): Promise<void> {
  await db
    .update(familyBilling)
    .set({
      premiumChildrenCount: data.premiumChildrenCount,
      monthlyAmountCents: data.monthlyAmountCents,
      billingStatus: BILLING_STATUS.ACTIVE,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));
}

/**
 * Create initial billing record for parent
 */
export async function createBillingRecord(
  parentId: string,
  stripeCustomerId: string
): Promise<void> {
  await db.insert(familyBilling).values({
    parentId,
    stripeCustomerId,
    billingStatus: 'active',
    premiumChildrenCount: 0,
    monthlyAmountCents: 0,
  });
}

/**
 * Update billing record with customer ID
 */
export async function updateBillingCustomerId(
  parentId: string,
  stripeCustomerId: string
): Promise<void> {
  await db
    .update(familyBilling)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(familyBilling.parentId, parentId));
}
