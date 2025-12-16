/**
 * Stripe Webhook Routes - Handle Stripe Events
 *
 * Webhook endpoint for Stripe subscription lifecycle events
 * Updated for family-based billing with per-child pricing model
 *
 * Subscription Schedule Events:
 * - subscription_schedule.updated: Phase changed (e.g., child removal applied at period end)
 * - subscription_schedule.released: Schedule released back to regular subscription
 *
 * @see https://docs.stripe.com/webhooks
 * @see https://docs.stripe.com/billing/subscriptions/webhooks
 * @see https://docs.stripe.com/billing/subscriptions/subscription-schedules
 */

import { Elysia } from 'elysia';
import Stripe from 'stripe';
import { stripe, stripeService } from '../lib/stripe';
import { db } from '../db/connection';
import { familyBilling, userSubscriptions } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../lib/observability';

// ============================================
// Configuration
// ============================================

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is required for webhook validation');
}

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ============================================
// Webhook Route
// ============================================

/**
 * Stripe Webhook Endpoint
 *
 * IMPORTANT: This endpoint requires raw body (unparsed) for signature verification
 *
 * Events handled:
 * - checkout.session.completed: New subscription created via Checkout
 * - invoice.paid: Recurring payment succeeded
 * - invoice.payment_failed: Payment failed
 * - customer.subscription.updated: Subscription modified
 * - customer.subscription.deleted: Subscription canceled
 * - subscription_schedule.updated: Schedule phase changed (child removal applied)
 */
export const stripeWebhookRoutes = new Elysia({ prefix: '/webhooks/stripe' }).post(
  '/',
  async ({ request, set }) => {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      set.status = 400;
      return { error: 'Missing stripe-signature header' };
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature (CRITICAL for security)
      // Using async version for Bun compatibility (SubtleCryptoProvider requires async)
      event = await stripeService.constructWebhookEventAsync(rawBody, signature, WEBHOOK_SECRET);
    } catch (error) {
      logger.error('[Stripe Webhook] Signature verification failed', { operation: 'stripe:webhook:verify', _error: error instanceof Error ? error.message : String(error), severity: 'high' as const });
      set.status = 400;
      return { error: 'Invalid signature' };
    }

    logger.info(`[Stripe Webhook] Received: ${event.type}`, { operation: 'stripe:webhook:receive', eventType: event.type });

    try {
      // Route events to handlers
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
          logger.debug(`[Stripe Webhook] Unhandled event: ${event.type}`, { operation: 'stripe:webhook:unhandled', eventType: event.type });
      }

      // Return 200 quickly (Stripe best practice)
      return { received: true, event: event.type };
    } catch (error) {
      logger.error(`[Stripe Webhook] Error processing ${event.type}`, { operation: 'stripe:webhook:process', eventType: event.type, _error: error instanceof Error ? error.message : String(error), severity: 'high' as const });
      // Return 500 so Stripe will retry
      set.status = 500;
      return { error: 'Webhook processing failed' };
    }
  },
  {
    // Skip body parsing - we need raw body for signature verification
    parse: 'none',
  }
);

// ============================================
// Event Handlers
// ============================================

/**
 * Handle checkout.session.completed
 * New subscription created via Stripe Checkout
 *
 * This is triggered when a parent completes the checkout to upgrade their children.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  if (!subscriptionId) {
    logger.warn('[Stripe Webhook] Checkout completed without subscription', { operation: 'stripe:webhook:checkout' });
    return;
  }

  const parentId = session.metadata?.parentId;
  if (!parentId) {
    logger.error('[Stripe Webhook] Missing parentId in checkout session metadata', { operation: 'stripe:webhook:checkout', _error: 'parentId not found in session.metadata', severity: 'medium' as const });
    return;
  }

  // Parse children IDs from metadata
  let childrenIds: string[] = [];
  try {
    const childrenJson = session.metadata?.childrenIds;
    if (childrenJson) {
      childrenIds = JSON.parse(childrenJson);
    }
  } catch {
    logger.error('[Stripe Webhook] Failed to parse childrenIds from metadata', { operation: 'stripe:webhook:checkout', _error: 'JSON.parse failed on session.metadata.childrenIds', severity: 'medium' as const });
  }

  const childrenCount = parseInt(session.metadata?.childrenCount ?? '0', 10) || childrenIds.length;

  // Get premium plan config to calculate price
  const planConfig = await stripeService.getPremiumPlanConfig();
  const monthlyAmount = planConfig
    ? stripeService.calculateMonthlyPrice(childrenCount, planConfig)
    : childrenCount * 1500; // Fallback: 15€ per child

  // Get subscription period from Stripe
  const subscription = await getStripeSubscription(subscriptionId);
  const period = extractPeriodFromItem(subscription?.items?.data?.[0]);

  const periodStart = period.start
    ? new Date(period.start * 1000)
    : new Date();
  const periodEnd = period.end
    ? new Date(period.end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Update family_billing
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

  // Upgrade children to premium plan
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

  logger.info(`[Stripe Webhook] Subscription activated for parent ${parentId} with ${childrenCount} children`, { operation: 'stripe:webhook:checkout:complete', parentId, childrenCount });
}

/**
 * Handle invoice.paid
 * Recurring payment succeeded - renew subscription period
 *
 * IMPORTANT: Only activates children from Stripe subscription metadata (source of truth)
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string | null;

  if (!customerId) {
    logger.warn('[Stripe Webhook] Invoice paid without customer ID', { operation: 'stripe:webhook:invoice' });
    return;
  }

  // Get subscription ID from invoice
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    logger.debug('[Stripe Webhook] Invoice paid (not subscription-related)', { operation: 'stripe:webhook:invoice' });
    return;
  }

  // Find family_billing by Stripe customer ID
  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) {
    logger.error(`[Stripe Webhook] family_billing not found for customer ${customerId}`, { operation: 'stripe:webhook:invoice', customerId, _error: 'No billing record found for Stripe customer', severity: 'medium' as const });
    return;
  }

  // Get subscription from Stripe (source of truth for childrenIds)
  const subscription = await getStripeSubscription(subscriptionId);
  if (!subscription) {
    logger.error(`[Stripe Webhook] Subscription ${subscriptionId} not found`, { operation: 'stripe:webhook:invoice', subscriptionId, _error: 'stripe.subscriptions.retrieve returned null', severity: 'medium' as const });
    return;
  }

  const period = extractPeriodFromItem(subscription.items?.data?.[0]);

  const periodStart = period.start
    ? new Date(period.start * 1000)
    : new Date();
  const periodEnd = period.end
    ? new Date(period.end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Update billing status
  await db
    .update(familyBilling)
    .set({
      billingStatus: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, billing.parentId));

  // Get children IDs from Stripe subscription metadata (SOURCE OF TRUTH)
  let childrenIds: string[] = [];
  try {
    childrenIds = JSON.parse(subscription.metadata?.childrenIds || '[]');
  } catch {
    logger.warn('[Stripe Webhook] Failed to parse childrenIds from subscription metadata', { operation: 'stripe:webhook:invoice' });
  }

  // Only activate children that are in the Stripe subscription
  if (childrenIds.length > 0) {
    await db
      .update(userSubscriptions)
      .set({
        status: 'active',
        lastResetAt: new Date(), // Reset token usage for new billing period
        tokensUsedToday: 0,
        updatedAt: new Date(),
      })
      .where(inArray(userSubscriptions.userId, childrenIds));
  }

  logger.info(`[Stripe Webhook] Invoice paid for parent ${billing.parentId}, ${childrenIds.length} children activated`, { operation: 'stripe:webhook:invoice:paid', parentId: billing.parentId, childrenCount: childrenIds.length });
}

/**
 * Handle invoice.payment_failed
 * Payment failed - mark subscription as past_due
 *
 * IMPORTANT: Only pauses children from Stripe subscription metadata
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string | null;

  if (!customerId) return;

  // Get subscription ID from invoice to read metadata
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) return;

  // Mark billing as past_due
  await db
    .update(familyBilling)
    .set({
      billingStatus: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, billing.parentId));

  // Get children IDs from Stripe subscription metadata (SOURCE OF TRUTH)
  let childrenIds: string[] = [];
  if (subscriptionId) {
    const subscription = await getStripeSubscription(subscriptionId);
    if (subscription?.metadata?.childrenIds) {
      try {
        childrenIds = JSON.parse(subscription.metadata.childrenIds);
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Only pause children that are in the Stripe subscription
  if (childrenIds.length > 0) {
    await db
      .update(userSubscriptions)
      .set({
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(inArray(userSubscriptions.userId, childrenIds));
  }

  logger.warn(`[Stripe Webhook] Payment failed for parent ${billing.parentId}, ${childrenIds.length} children paused`, { operation: 'stripe:webhook:invoice:failed', parentId: billing.parentId, childrenCount: childrenIds.length });
}

/**
 * Handle customer.subscription.updated
 * Subscription modified (upgrade/downgrade, status change)
 *
 * IMPORTANT: Only updates children from Stripe subscription metadata
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) return;

  // Get updated period using helper
  const period = extractPeriodFromItem(subscription.items?.data?.[0]);

  const periodStart = period.start
    ? new Date(period.start * 1000)
    : billing.currentPeriodStart;
  const periodEnd = period.end
    ? new Date(period.end * 1000)
    : billing.currentPeriodEnd;

  // Map Stripe status to billing status
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

  // Get children IDs from Stripe subscription metadata (SOURCE OF TRUTH)
  let childrenIds: string[] = [];
  if (subscription.metadata?.childrenIds) {
    try {
      childrenIds = JSON.parse(subscription.metadata.childrenIds);
    } catch {
      // Ignore parse errors
    }
  }

  // Update only subscribed children's status
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

  logger.info(`[Stripe Webhook] Subscription updated for parent ${billing.parentId}: ${subscription.status}, ${childrenIds.length} children affected`, { operation: 'stripe:webhook:subscription:updated', parentId: billing.parentId, status: subscription.status, childrenCount: childrenIds.length });
}

/**
 * Handle customer.subscription.deleted
 * Subscription canceled - revert subscribed children to free plan
 *
 * IMPORTANT: Only reverts children from Stripe subscription metadata
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) return;

  // Update family_billing
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

  // Get children IDs from Stripe subscription metadata (SOURCE OF TRUTH)
  let childrenIds: string[] = [];
  if (subscription.metadata?.childrenIds) {
    try {
      childrenIds = JSON.parse(subscription.metadata.childrenIds);
    } catch {
      // Ignore parse errors
    }
  }

  // Get free plan ID
  const freePlanId = await stripeService.getFreePlanId();

  // Downgrade only subscribed children to free plan
  if (freePlanId && childrenIds.length > 0) {
    await db
      .update(userSubscriptions)
      .set({
        planId: freePlanId,
        status: 'active',
        tokensUsedToday: 0, // Reset usage
        updatedAt: new Date(),
      })
      .where(inArray(userSubscriptions.userId, childrenIds));
  }

  logger.info(`[Stripe Webhook] Subscription deleted for parent ${billing.parentId} - ${childrenIds.length} children reverted to free`, { operation: 'stripe:webhook:subscription:deleted', parentId: billing.parentId, childrenCount: childrenIds.length });
}

/**
 * Handle subscription_schedule.updated
 * This fires when a schedule phase changes (e.g., child removal takes effect at period end)
 *
 * When the schedule transitions to its second phase (with reduced children),
 * we need to:
 * 1. Update family_billing with new children count
 * 2. Downgrade removed children to free plan
 */
async function handleScheduleUpdated(schedule: Stripe.SubscriptionSchedule): Promise<void> {
  // Check if this is a remove_children action
  if (schedule.metadata?.pendingAction !== 'remove_children') {
    logger.debug('[Stripe Webhook] Schedule updated (not a remove_children action)', { operation: 'stripe:webhook:schedule' });
    return;
  }

  // Get the current phase index
  const currentPhaseIndex = schedule.current_phase?.start_date
    ? schedule.phases.findIndex(
        (phase) => phase.start_date === schedule.current_phase?.start_date
      )
    : -1;

  // We only act when we're in the second phase (index 1) - the removal phase
  if (currentPhaseIndex !== 1) {
    logger.debug(`[Stripe Webhook] Schedule phase ${currentPhaseIndex} - waiting for removal phase`, { operation: 'stripe:webhook:schedule', currentPhaseIndex });
    return;
  }

  const removalPhase = schedule.phases[1];
  if (!removalPhase?.metadata?.action || removalPhase.metadata.action !== 'remove_children') {
    logger.debug('[Stripe Webhook] Current phase is not a removal phase', { operation: 'stripe:webhook:schedule' });
    return;
  }

  const parentId = schedule.metadata.parentId;
  if (!parentId) {
    logger.error('[Stripe Webhook] Missing parentId in schedule metadata', { operation: 'stripe:webhook:schedule', _error: 'parentId not found in schedule.metadata', severity: 'medium' as const });
    return;
  }

  // Parse removed children IDs
  let removedChildrenIds: string[] = [];
  try {
    removedChildrenIds = JSON.parse(schedule.metadata.removedChildrenIds || '[]');
  } catch {
    logger.error('[Stripe Webhook] Failed to parse removedChildrenIds', { operation: 'stripe:webhook:schedule', _error: 'JSON.parse failed on schedule.metadata.removedChildrenIds', severity: 'medium' as const });
    return;
  }

  // Get new children count from phase metadata
  const newChildrenCount = parseInt(removalPhase.metadata.childrenCount || '0', 10);

  // Get plan config for price calculation
  const planConfig = await stripeService.getPremiumPlanConfig();
  const newMonthlyAmount = planConfig
    ? stripeService.calculateMonthlyPrice(newChildrenCount, planConfig)
    : newChildrenCount * 1500;

  // Update family_billing
  await db
    .update(familyBilling)
    .set({
      premiumChildrenCount: newChildrenCount,
      monthlyAmountCents: newMonthlyAmount,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, parentId));

  // Downgrade removed children to free plan
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

  logger.info(`[Stripe Webhook] Schedule phase applied for parent ${parentId} - ${removedChildrenIds.length} children downgraded to free`, { operation: 'stripe:webhook:schedule:applied', parentId, removedCount: removedChildrenIds.length });
}

// ============================================
// Helpers
// ============================================

/**
 * Extract subscription ID from invoice object
 * Handles different Stripe API structures
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // Try direct subscription field first (older API versions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directSubscription = (invoice as any).subscription;
  if (typeof directSubscription === 'string') {
    return directSubscription;
  }

  // Try parent.subscription_details.subscription (newer API structure)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parentSubscription = (invoice as any).parent?.subscription_details?.subscription;
  if (typeof parentSubscription === 'string') {
    return parentSubscription;
  }

  return null;
}

/**
 * Get Stripe subscription with expanded items
 * Uses the shared stripe instance from stripe.service
 */
async function getStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data'],
    });
  } catch {
    return null;
  }
}

/**
 * Extract period from subscription item (helper to avoid type casting)
 */
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
