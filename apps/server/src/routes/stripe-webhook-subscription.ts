import Stripe from 'stripe';
import { stripeService, parseChildrenIdsFromMetadata } from '../lib/stripe';
import { billingService } from '../services/billing';
import { db } from '../db/connection';
import { familyBilling, userSubscriptions } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../lib/observability';

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) return;

  const item = subscription.items?.data?.[0];
  const itemWithPeriod = item as (Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  }) | undefined;

  const periodStart = itemWithPeriod?.current_period_start
    ? new Date(itemWithPeriod.current_period_start * 1000)
    : billing.currentPeriodStart;
  const periodEnd = itemWithPeriod?.current_period_end
    ? new Date(itemWithPeriod.current_period_end * 1000)
    : billing.currentPeriodEnd;

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

  const childrenIds = parseChildrenIdsFromMetadata(subscription.metadata?.childrenIds);

  if (childrenIds.length > 0) {
    // Children retain premium access while the parent's subscription is
    // 'active' OR 'canceled'. The 'canceled' billing state here refers to
    // "cancel_at_period_end=true while Stripe status is still active" (set
    // above on line 35) — the parent already paid for the current period,
    // so children keep access until handleSubscriptionDeleted fires at the
    // true end of the period and downgrades them to 'free'. Any other
    // billingStatus (past_due, expired) pauses the children immediately.
    const childKeepsAccess = billingStatus === 'active' || billingStatus === 'canceled';
    const childStatus = childKeepsAccess ? 'active' : 'paused';
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

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.stripeCustomerId, customerId))
    .limit(1);

  if (!billing) return;

  const childrenIds = parseChildrenIdsFromMetadata(subscription.metadata?.childrenIds);

  await billingService.expireAndDowngrade(billing.parentId, childrenIds, {
    clearStripeSubscriptionId: true,
  });

  logger.info(`[Stripe Webhook] Subscription deleted for parent ${billing.parentId} - ${childrenIds.length} children reverted to free`, {
    operation: 'stripe:webhook:subscription:deleted',
    parentId: billing.parentId,
    childrenCount: childrenIds.length,
  });
}

export async function handleScheduleUpdated(schedule: Stripe.SubscriptionSchedule): Promise<void> {
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
