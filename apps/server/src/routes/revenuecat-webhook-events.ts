import { db } from '../db/connection';
import { familyBilling, userSubscriptions } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../lib/observability';
import { DEFAULT_PERIOD_MS } from '../lib/stripe/helpers';
import { getFreePlanId, getPremiumPlanId } from '../lib/stripe/config';

// ============================================
// Types
// ============================================

export interface RevenueCatEvent {
  api_version: string;
  event: {
    type: RevenueCatEventType;
    id: string;
    app_id: string;
    app_user_id: string;
    original_app_user_id: string;
    aliases: string[];
    product_id: string;
    entitlement_ids: string[];
    event_timestamp_ms: number;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    store: string;
    environment: 'SANDBOX' | 'PRODUCTION';
    price?: number;
    currency?: string;
    period_type?: string;
    cancel_reason?: string;
    expiration_reason?: string;
    new_product_id?: string;
    subscriber_attributes?: Record<string, { value: string; updated_at_ms: number }>;
  };
}

export type RevenueCatEventType =
  | 'TEST'
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'TRANSFER'
  | 'SUBSCRIPTION_EXTENDED'
  | 'TEMPORARY_ENTITLEMENT_GRANT';

// ============================================
// Helpers
// ============================================

function parseChildrenIds(attributes?: Record<string, { value: string }>): string[] {
  const childrenIdsAttr = attributes?.children_ids?.value;
  if (!childrenIdsAttr) return [];

  try {
    const parsed = JSON.parse(childrenIdsAttr);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return parsed;
    }
  } catch {
    // Invalid JSON
  }

  return [];
}

// ============================================
// Event Handlers
// ============================================

export async function handleInitialPurchase(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  const childrenIds = parseChildrenIds(event.subscriber_attributes);

  const expirationAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : new Date(Date.now() + DEFAULT_PERIOD_MS);

  await db
    .insert(familyBilling)
    .values({
      parentId,
      revenuecatCustomerId: event.original_app_user_id,
      revenuecatSubscriptionId: event.product_id,
      billingStatus: 'active',
      currentPeriodStart: new Date(event.purchased_at_ms ?? Date.now()),
      currentPeriodEnd: expirationAt,
      premiumChildrenCount: childrenIds.length || 1,
    })
    .onConflictDoUpdate({
      target: familyBilling.parentId,
      set: {
        revenuecatCustomerId: event.original_app_user_id,
        revenuecatSubscriptionId: event.product_id,
        billingStatus: 'active',
        currentPeriodStart: new Date(event.purchased_at_ms ?? Date.now()),
        currentPeriodEnd: expirationAt,
        premiumChildrenCount: childrenIds.length || 1,
        updatedAt: new Date(),
      },
    });

  if (childrenIds.length > 0) {
    const premiumPlanId = await getPremiumPlanId();
    if (premiumPlanId) {
      for (const childId of childrenIds) {
        await db
          .insert(userSubscriptions)
          .values({
            userId: childId,
            planId: premiumPlanId,
            status: 'active',
            tokensUsedToday: 0,
          })
          .onConflictDoUpdate({
            target: userSubscriptions.userId,
            set: {
              planId: premiumPlanId,
              status: 'active',
              updatedAt: new Date(),
            },
          });
      }
    }
  }

  logger.info(`[RevenueCat Webhook] Initial purchase for parent ${parentId}`, {
    operation: 'revenuecat:webhook:initial_purchase',
    parentId,
    productId: event.product_id,
    childrenCount: childrenIds.length,
  });
}

export async function handleRenewal(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;

  const expirationAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : new Date(Date.now() + DEFAULT_PERIOD_MS);

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'active',
      currentPeriodEnd: expirationAt,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));

  const childrenIds = parseChildrenIds(event.subscriber_attributes);
  if (childrenIds.length > 0) {
    await db
      .update(userSubscriptions)
      .set({
        status: 'active',
        lastResetAt: new Date(),
        tokensUsedToday: 0,
        updatedAt: new Date(),
      })
      .where(inArray(userSubscriptions.userId, childrenIds));
  }

  logger.info(`[RevenueCat Webhook] Renewal for parent ${parentId}`, {
    operation: 'revenuecat:webhook:renewal',
    parentId,
  });
}

export async function handleCancellation(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'canceled',
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));

  logger.info(`[RevenueCat Webhook] Cancellation for parent ${parentId}`, {
    operation: 'revenuecat:webhook:cancellation',
    parentId,
    reason: event.cancel_reason,
  });
}

export async function handleExpiration(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  const childrenIds = parseChildrenIds(event.subscriber_attributes);

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'expired',
      premiumChildrenCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));

  const freePlanId = await getFreePlanId();
  if (freePlanId && childrenIds.length > 0) {
    await db
      .update(userSubscriptions)
      .set({
        planId: freePlanId,
        status: 'active',
        tokensUsedToday: 0,
        updatedAt: new Date(),
      })
      .where(inArray(userSubscriptions.userId, childrenIds));
  }

  logger.info(`[RevenueCat Webhook] Expiration for parent ${parentId}`, {
    operation: 'revenuecat:webhook:expiration',
    parentId,
    reason: event.expiration_reason,
    childrenDowngraded: childrenIds.length,
  });
}

export async function handleBillingIssue(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));

  logger.warn(`[RevenueCat Webhook] Billing issue for parent ${parentId}`, {
    operation: 'revenuecat:webhook:billing_issue',
    parentId,
    severity: 'medium' as const,
  });
}

export async function handleUncancellation(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'active',
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));

  logger.info(`[RevenueCat Webhook] Uncancellation for parent ${parentId}`, {
    operation: 'revenuecat:webhook:uncancellation',
    parentId,
  });
}
