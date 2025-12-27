/**
 * Stripe Webhook Handler - Event Processing Logic
 *
 * Contains all webhook event handlers for Stripe subscription lifecycle.
 * This file is only imported when Stripe is configured.
 *
 * @see https://docs.stripe.com/webhooks
 */

import { Elysia } from 'elysia';
import Stripe from 'stripe';
import { requireStripe, stripeService, parseChildrenIdsFromMetadata } from '../lib/stripe';
import { db } from '../db/connection';
import { familyBilling, userSubscriptions } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../lib/observability';
import { redisService } from '../lib/redis.service';

// ============================================
// Factory Function
// ============================================

// Security: Max body size for Stripe webhooks (256KB is plenty for Stripe events)
const MAX_WEBHOOK_BODY_SIZE = 256 * 1024; // 256KB

// Idempotency: TTL for processed event IDs (24 hours)
const WEBHOOK_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const WEBHOOK_EVENT_KEY_PREFIX = 'stripe:webhook:processed:';

/**
 * Check if a webhook event has already been processed (idempotency)
 * Returns true if the event was already processed
 */
async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  try {
    return await redisService.exists(`${WEBHOOK_EVENT_KEY_PREFIX}${eventId}`);
  } catch (error) {
    // If Redis fails, allow processing (fail open for availability)
    logger.warn('[Stripe Webhook] Idempotency check failed, allowing processing', {
      operation: 'stripe:webhook:idempotency:check',
      eventId,
      _error: error instanceof Error ? error.message : String(error),
      severity: 'medium' as const,
    });
    return false;
  }
}

/**
 * Mark a webhook event as processed (idempotency)
 */
async function markEventAsProcessed(eventId: string): Promise<void> {
  try {
    await redisService.set(
      `${WEBHOOK_EVENT_KEY_PREFIX}${eventId}`,
      Date.now().toString(),
      WEBHOOK_IDEMPOTENCY_TTL_SECONDS
    );
  } catch (error) {
    // Log but don't fail - event was already processed successfully
    logger.warn('[Stripe Webhook] Failed to mark event as processed', {
      operation: 'stripe:webhook:idempotency:mark',
      eventId,
      _error: error instanceof Error ? error.message : String(error),
      severity: 'low' as const,
    });
  }
}

/**
 * Create webhook routes with the provided secret
 * Only called when Stripe is enabled
 */
export function createWebhookRoutes(webhookSecret: string) {
  return new Elysia({ prefix: '/webhooks/stripe' }).post(
    '/',
    async ({ request, set }) => {
      // SECURITY: Check Content-Length header to prevent oversized payloads
      const contentLength = request.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > MAX_WEBHOOK_BODY_SIZE) {
          logger.warn('[Stripe Webhook] Request too large', {
            operation: 'stripe:webhook:size-limit',
            contentLength: size,
            maxAllowed: MAX_WEBHOOK_BODY_SIZE,
            severity: 'medium' as const,
          });
          set.status = 413;
          return { error: 'Request entity too large' };
        }
      }

      const rawBody = await request.text();

      // SECURITY: Additional body size check (in case Content-Length was spoofed)
      if (rawBody.length > MAX_WEBHOOK_BODY_SIZE) {
        logger.warn('[Stripe Webhook] Body too large after read', {
          operation: 'stripe:webhook:size-limit',
          bodyLength: rawBody.length,
          maxAllowed: MAX_WEBHOOK_BODY_SIZE,
          severity: 'medium' as const,
        });
        set.status = 413;
        return { error: 'Request entity too large' };
      }

      const signature = request.headers.get('stripe-signature');

      if (!signature) {
        set.status = 400;
        return { error: 'Missing stripe-signature header' };
      }

      let event: Stripe.Event;

      try {
        event = await stripeService.constructWebhookEventAsync(rawBody, signature, webhookSecret);
      } catch (error) {
        logger.error('[Stripe Webhook] Signature verification failed', {
          operation: 'stripe:webhook:verify',
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        set.status = 400;
        return { error: 'Invalid signature' };
      }

      // SECURITY: Idempotency check - skip duplicate events
      if (await isEventAlreadyProcessed(event.id)) {
        logger.info(`[Stripe Webhook] Duplicate event skipped: ${event.id}`, {
          operation: 'stripe:webhook:duplicate',
          eventId: event.id,
          eventType: event.type,
        });
        return { received: true, duplicate: true };
      }

      logger.info(`[Stripe Webhook] Received: ${event.type}`, {
        operation: 'stripe:webhook:receive',
        eventId: event.id,
        eventType: event.type,
      });

      try {
        switch (event.type) {
          case 'checkout.session.completed':
            await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
            break;
          case 'invoice.paid':
            await handleInvoicePaid(event.data.object as Stripe.Invoice);
            break;
          case 'invoice.payment_failed':
            await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
            break;
          case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
            break;
          case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
            break;
          case 'subscription_schedule.updated':
            await handleScheduleUpdated(event.data.object as Stripe.SubscriptionSchedule);
            break;
          default:
            logger.debug(`[Stripe Webhook] Unhandled event: ${event.type}`, {
              operation: 'stripe:webhook:unhandled',
              eventType: event.type,
            });
        }

        // SECURITY: Mark event as processed for idempotency
        await markEventAsProcessed(event.id);

        return { received: true, event: event.type };
      } catch (error) {
        logger.error(`[Stripe Webhook] Error processing ${event.type}`, {
          operation: 'stripe:webhook:process',
          eventType: event.type,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        set.status = 500;
        return { error: 'Webhook processing failed' };
      }
    },
    { parse: 'none' }
  );
}

// ============================================
// Event Handlers
// ============================================

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  if (!subscriptionId) {
    logger.warn('[Stripe Webhook] Checkout completed without subscription', {
      operation: 'stripe:webhook:checkout',
    });
    return;
  }

  const parentId = session.metadata?.parentId;
  if (!parentId) {
    logger.error('[Stripe Webhook] Missing parentId in checkout session metadata', {
      operation: 'stripe:webhook:checkout',
      _error: 'parentId not found in session.metadata',
      severity: 'medium' as const,
    });
    return;
  }

  // SECURITY: Use Zod-validated parsing for metadata
  const childrenIds = parseChildrenIdsFromMetadata(session.metadata?.childrenIds);

  const childrenCount = parseInt(session.metadata?.childrenCount ?? '0', 10) || childrenIds.length;

  const planConfig = await stripeService.getPremiumPlanConfig();
  const monthlyAmount = planConfig
    ? stripeService.calculateMonthlyPrice(childrenCount, planConfig)
    : childrenCount * 1500;

  const subscription = await getStripeSubscription(subscriptionId);
  const period = extractPeriodFromItem(subscription?.items?.data?.[0]);

  const periodStart = period.start ? new Date(period.start * 1000) : new Date();
  const periodEnd = period.end
    ? new Date(period.end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db
    .insert(familyBilling)
    .values({
      parentId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      billingStatus: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      monthlyAmountCents: monthlyAmount,
      premiumChildrenCount: childrenCount,
    })
    .onConflictDoUpdate({
      target: familyBilling.parentId,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        billingStatus: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        monthlyAmountCents: monthlyAmount,
        premiumChildrenCount: childrenCount,
        updatedAt: new Date(),
      },
    });

  if (childrenIds.length > 0) {
    const premiumPlanId = await stripeService.getPremiumPlanId();

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

  logger.info(`[Stripe Webhook] Subscription activated for parent ${parentId} with ${childrenCount} children`, {
    operation: 'stripe:webhook:checkout:complete',
    parentId,
    childrenCount,
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string | null;

  if (!customerId) {
    logger.warn('[Stripe Webhook] Invoice paid without customer ID', {
      operation: 'stripe:webhook:invoice',
    });
    return;
  }

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    logger.debug('[Stripe Webhook] Invoice paid (not subscription-related)', {
      operation: 'stripe:webhook:invoice',
    });
    return;
  }

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) {
    logger.error(`[Stripe Webhook] family_billing not found for customer ${customerId}`, {
      operation: 'stripe:webhook:invoice',
      customerId,
      _error: 'No billing record found for Stripe customer',
      severity: 'medium' as const,
    });
    return;
  }

  const subscription = await getStripeSubscription(subscriptionId);
  if (!subscription) {
    logger.error(`[Stripe Webhook] Subscription ${subscriptionId} not found`, {
      operation: 'stripe:webhook:invoice',
      subscriptionId,
      _error: 'stripe.subscriptions.retrieve returned null',
      severity: 'medium' as const,
    });
    return;
  }

  const period = extractPeriodFromItem(subscription.items?.data?.[0]);

  const periodStart = period.start ? new Date(period.start * 1000) : new Date();
  const periodEnd = period.end
    ? new Date(period.end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, billing.parentId));

  // SECURITY: Use Zod-validated parsing for metadata
  const childrenIds = parseChildrenIdsFromMetadata(subscription.metadata?.childrenIds);

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

  logger.info(`[Stripe Webhook] Invoice paid for parent ${billing.parentId}, ${childrenIds.length} children activated`, {
    operation: 'stripe:webhook:invoice:paid',
    parentId: billing.parentId,
    childrenCount: childrenIds.length,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string | null;

  if (!customerId) return;

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) return;

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, billing.parentId));

  // SECURITY: Use Zod-validated parsing for metadata
  let childrenIds: string[] = [];
  if (subscriptionId) {
    const subscription = await getStripeSubscription(subscriptionId);
    childrenIds = parseChildrenIdsFromMetadata(subscription?.metadata?.childrenIds);
  }

  if (childrenIds.length > 0) {
    await db
      .update(userSubscriptions)
      .set({
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(inArray(userSubscriptions.userId, childrenIds));
  }

  logger.warn(`[Stripe Webhook] Payment failed for parent ${billing.parentId}, ${childrenIds.length} children paused`, {
    operation: 'stripe:webhook:invoice:failed',
    parentId: billing.parentId,
    childrenCount: childrenIds.length,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) return;

  const period = extractPeriodFromItem(subscription.items?.data?.[0]);

  const periodStart = period.start ? new Date(period.start * 1000) : billing.currentPeriodStart;
  const periodEnd = period.end ? new Date(period.end * 1000) : billing.currentPeriodEnd;

  let billingStatus = billing.billingStatus;
  switch (subscription.status) {
    case 'active':
      billingStatus = subscription.cancel_at_period_end ? 'canceled' : 'active';
      break;
    case 'past_due':
      billingStatus = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
      billingStatus = 'expired';
      break;
    default:
      billingStatus = 'active';
  }

  await db
    .update(familyBilling)
    .set({
      billingStatus,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, billing.parentId));

  // SECURITY: Use Zod-validated parsing for metadata
  const childrenIds = parseChildrenIdsFromMetadata(subscription.metadata?.childrenIds);

  if (childrenIds.length > 0) {
    const childStatus = billingStatus === 'active' ? 'active' : billingStatus === 'canceled' ? 'active' : 'paused';
    await db
      .update(userSubscriptions)
      .set({
        status: childStatus,
        updatedAt: new Date(),
      })
      .where(inArray(userSubscriptions.userId, childrenIds));
  }

  logger.info(`[Stripe Webhook] Subscription updated for parent ${billing.parentId}: ${subscription.status}, ${childrenIds.length} children affected`, {
    operation: 'stripe:webhook:subscription:updated',
    parentId: billing.parentId,
    status: subscription.status,
    childrenCount: childrenIds.length,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) return;

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'expired',
      premiumChildrenCount: 0,
      monthlyAmountCents: 0,
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, billing.parentId));

  // SECURITY: Use Zod-validated parsing for metadata
  const childrenIds = parseChildrenIdsFromMetadata(subscription.metadata?.childrenIds);

  const freePlanId = await stripeService.getFreePlanId();

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

  logger.info(`[Stripe Webhook] Subscription deleted for parent ${billing.parentId} - ${childrenIds.length} children reverted to free`, {
    operation: 'stripe:webhook:subscription:deleted',
    parentId: billing.parentId,
    childrenCount: childrenIds.length,
  });
}

async function handleScheduleUpdated(schedule: Stripe.SubscriptionSchedule): Promise<void> {
  if (schedule.metadata?.pendingAction !== 'remove_children') {
    logger.debug('[Stripe Webhook] Schedule updated (not a remove_children action)', {
      operation: 'stripe:webhook:schedule',
    });
    return;
  }

  const currentPhaseIndex = schedule.current_phase?.start_date
    ? schedule.phases.findIndex((phase) => phase.start_date === schedule.current_phase?.start_date)
    : -1;

  if (currentPhaseIndex !== 1) {
    logger.debug(`[Stripe Webhook] Schedule phase ${currentPhaseIndex} - waiting for removal phase`, {
      operation: 'stripe:webhook:schedule',
      currentPhaseIndex,
    });
    return;
  }

  const removalPhase = schedule.phases[1];
  if (!removalPhase?.metadata?.action || removalPhase.metadata.action !== 'remove_children') {
    logger.debug('[Stripe Webhook] Current phase is not a removal phase', {
      operation: 'stripe:webhook:schedule',
    });
    return;
  }

  const parentId = schedule.metadata.parentId;
  if (!parentId) {
    logger.error('[Stripe Webhook] Missing parentId in schedule metadata', {
      operation: 'stripe:webhook:schedule',
      _error: 'parentId not found in schedule.metadata',
      severity: 'medium' as const,
    });
    return;
  }

  // SECURITY: Use Zod-validated parsing for metadata
  const removedChildrenIds = parseChildrenIdsFromMetadata(schedule.metadata.removedChildrenIds);

  const newChildrenCount = parseInt(removalPhase.metadata.childrenCount || '0', 10);

  const planConfig = await stripeService.getPremiumPlanConfig();
  const newMonthlyAmount = planConfig
    ? stripeService.calculateMonthlyPrice(newChildrenCount, planConfig)
    : newChildrenCount * 1500;

  await db
    .update(familyBilling)
    .set({
      premiumChildrenCount: newChildrenCount,
      monthlyAmountCents: newMonthlyAmount,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));

  if (removedChildrenIds.length > 0) {
    const freePlanId = await stripeService.getFreePlanId();

    if (freePlanId) {
      await db
        .update(userSubscriptions)
        .set({
          planId: freePlanId,
          status: 'active',
          tokensUsedToday: 0,
          updatedAt: new Date(),
        })
        .where(inArray(userSubscriptions.userId, removedChildrenIds));
    }
  }

  logger.info(`[Stripe Webhook] Schedule phase applied for parent ${parentId} - ${removedChildrenIds.length} children downgraded to free`, {
    operation: 'stripe:webhook:schedule:applied',
    parentId,
    removedCount: removedChildrenIds.length,
  });
}

// ============================================
// Helpers
// ============================================

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directSubscription = (invoice as any).subscription;
  if (typeof directSubscription === 'string') {
    return directSubscription;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parentSubscription = (invoice as any).parent?.subscription_details?.subscription;
  if (typeof parentSubscription === 'string') {
    return parentSubscription;
  }

  return null;
}

async function getStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    return await requireStripe().subscriptions.retrieve(subscriptionId, {
      expand: ['items.data'],
    });
  } catch {
    return null;
  }
}

function extractPeriodFromItem(item: Stripe.SubscriptionItem | undefined): { start: number; end: number } {
  if (!item) return { start: 0, end: 0 };
  const itemWithPeriod = item as Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    start: itemWithPeriod.current_period_start ?? 0,
    end: itemWithPeriod.current_period_end ?? 0,
  };
}
