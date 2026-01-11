/**
 * RevenueCat Webhook Handler - Event Processing Logic
 *
 * Handles RevenueCat webhook events for subscription lifecycle.
 * Mirrors the Stripe webhook pattern but adapted for RevenueCat.
 *
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */

import { Elysia } from 'elysia';
import { db } from '../db/connection';
import { familyBilling, userSubscriptions, subscriptionPlans } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../lib/observability';
import { redisService } from '../lib/redis.service';

// ============================================
// Types
// ============================================

interface RevenueCatEvent {
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

type RevenueCatEventType =
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
// Configuration
// ============================================

const WEBHOOK_AUTH_HEADER = process.env.REVENUECAT_WEBHOOK_AUTH;
const WEBHOOK_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const WEBHOOK_EVENT_KEY_PREFIX = 'revenuecat:webhook:processed:';

// ============================================
// Helpers
// ============================================

async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  try {
    return await redisService.exists(`${WEBHOOK_EVENT_KEY_PREFIX}${eventId}`);
  } catch (error) {
    logger.warn('[RevenueCat Webhook] Idempotency check failed', {
      operation: 'revenuecat:webhook:idempotency:check',
      eventId,
      _error: error instanceof Error ? error.message : String(error),
      severity: 'medium' as const,
    });
    return false;
  }
}

async function markEventAsProcessed(eventId: string): Promise<void> {
  try {
    await redisService.set(
      `${WEBHOOK_EVENT_KEY_PREFIX}${eventId}`,
      Date.now().toString(),
      WEBHOOK_IDEMPOTENCY_TTL_SECONDS
    );
  } catch (error) {
    logger.warn('[RevenueCat Webhook] Failed to mark event as processed', {
      operation: 'revenuecat:webhook:idempotency:mark',
      eventId,
      _error: error instanceof Error ? error.message : String(error),
      severity: 'low' as const,
    });
  }
}

/**
 * Parse children IDs from subscriber attributes.
 */
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

/**
 * Get premium plan ID from database.
 */
async function getPremiumPlanId(): Promise<string | null> {
  const [plan] = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, 'premium'))
    .limit(1);
  return plan?.id ?? null;
}

/**
 * Get free plan ID from database.
 */
async function getFreePlanId(): Promise<string | null> {
  const [plan] = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, 'free'))
    .limit(1);
  return plan?.id ?? null;
}

// ============================================
// Event Handlers
// ============================================

async function handleInitialPurchase(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  const childrenIds = parseChildrenIds(event.subscriber_attributes);

  const expirationAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Update family billing
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

  // Activate children subscriptions
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

async function handleRenewal(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;

  const expirationAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'active',
      currentPeriodEnd: expirationAt,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));

  // Reactivate children
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

async function handleCancellation(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;

  // Mark as canceled (still active until period end)
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

async function handleExpiration(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  const childrenIds = parseChildrenIds(event.subscriber_attributes);

  // Mark billing as expired
  await db
    .update(familyBilling)
    .set({
      billingStatus: 'expired',
      premiumChildrenCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));

  // Downgrade children to free plan
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

async function handleBillingIssue(event: RevenueCatEvent['event']): Promise<void> {
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

async function handleUncancellation(event: RevenueCatEvent['event']): Promise<void> {
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

// ============================================
// Routes
// ============================================

export function createRevenueCatWebhookRoutes() {
  return new Elysia({ prefix: '/webhooks/revenuecat' }).post(
    '/',
    async ({ request, body, set }) => {
      // Verify authorization header
      if (WEBHOOK_AUTH_HEADER) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== WEBHOOK_AUTH_HEADER) {
          logger.warn('[RevenueCat Webhook] Invalid authorization', {
            operation: 'revenuecat:webhook:auth',
            severity: 'high' as const,
          });
          set.status = 401;
          return { error: 'Unauthorized' };
        }
      }

      const payload = body as RevenueCatEvent;
      const event = payload.event;

      // Skip sandbox events in production
      if (process.env.NODE_ENV === 'production' && event.environment === 'SANDBOX') {
        return { received: true, skipped: 'sandbox' };
      }

      // Idempotency check
      if (await isEventAlreadyProcessed(event.id)) {
        logger.info(`[RevenueCat Webhook] Duplicate event skipped: ${event.id}`, {
          operation: 'revenuecat:webhook:duplicate',
          eventId: event.id,
        });
        return { received: true, duplicate: true };
      }

      logger.info(`[RevenueCat Webhook] Received: ${event.type}`, {
        operation: 'revenuecat:webhook:receive',
        eventId: event.id,
        eventType: event.type,
        appUserId: event.app_user_id,
      });

      try {
        switch (event.type) {
          case 'TEST':
            logger.info('[RevenueCat Webhook] Test event received');
            break;
          case 'INITIAL_PURCHASE':
          case 'NON_RENEWING_PURCHASE':
            await handleInitialPurchase(event);
            break;
          case 'RENEWAL':
            await handleRenewal(event);
            break;
          case 'CANCELLATION':
            await handleCancellation(event);
            break;
          case 'EXPIRATION':
            await handleExpiration(event);
            break;
          case 'BILLING_ISSUE':
            await handleBillingIssue(event);
            break;
          case 'UNCANCELLATION':
            await handleUncancellation(event);
            break;
          case 'PRODUCT_CHANGE':
            // Handle like renewal with new product
            await handleRenewal(event);
            break;
          default:
            logger.debug(`[RevenueCat Webhook] Unhandled event: ${event.type}`, {
              operation: 'revenuecat:webhook:unhandled',
              eventType: event.type,
            });
        }

        await markEventAsProcessed(event.id);
        return { received: true, event: event.type };
      } catch (error) {
        logger.error(`[RevenueCat Webhook] Error processing ${event.type}`, {
          operation: 'revenuecat:webhook:process',
          eventType: event.type,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        set.status = 500;
        return { error: 'Webhook processing failed' };
      }
    }
  );
}
