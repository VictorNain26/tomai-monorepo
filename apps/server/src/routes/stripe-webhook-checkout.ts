import Stripe from 'stripe';
import { requireStripe, stripeService, parseChildrenIdsFromMetadata } from '../lib/stripe';
import { DEFAULT_PERIOD_MS } from '../lib/stripe/helpers';
import { db } from '../db/connection';
import { familyBilling, userSubscriptions } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../lib/observability';

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

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
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
    : new Date(Date.now() + DEFAULT_PERIOD_MS);

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

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
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
    : new Date(Date.now() + DEFAULT_PERIOD_MS);

  await db
    .update(familyBilling)
    .set({
      billingStatus: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(familyBilling.parentId, billing.parentId));

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

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
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
