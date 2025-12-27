/**
 * Stripe Subscription Status
 *
 * Handles subscription status retrieval, portal sessions, and prorata calculations.
 */

import type Stripe from 'stripe';
import { db } from '../../db/connection';
import { familyBilling } from '../../db/schema';
import { eq } from 'drizzle-orm';

import { requireStripe, getPremiumPlanConfig } from './config';
import {
  NoPlanConfiguredError,
  NoSubscriptionError,
  NoCustomerError,
} from './errors';
import type { SubscriptionInfo, ProrataCalculation } from './types';
import {
  SCHEDULE_ACTION,
  extractPeriodFromItem,
  parseChildrenIdsFromMetadata,
  getScheduleId,
  isPendingCancellation,
  calculateMonthlyPrice,
} from './helpers';
import { getBilling } from './billing';
import { logger } from '../observability';

// ============================================
// Portal Session
// ============================================

export async function createPortalSession(params: {
  parentId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.parentId, params.parentId))
    .limit(1);

  if (!billing?.stripeCustomerId) {
    throw new NoCustomerError();
  }

  return requireStripe().billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: params.returnUrl,
  });
}

// ============================================
// Subscription Status
// ============================================

export async function getSubscriptionStatus(parentId: string): Promise<SubscriptionInfo | null> {
  const billing = await getBilling(parentId);
  if (!billing?.stripeSubscriptionId) return null;

  try {
    const subscription = await requireStripe().subscriptions.retrieve(billing.stripeSubscriptionId, {
      expand: ['items.data', 'schedule'],
    });

    const period = extractPeriodFromItem(subscription.items.data[0]);
    const scheduleInfo = await extractScheduleInfo(subscription);

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(period.start * 1000),
      currentPeriodEnd: new Date(period.end * 1000),
      premiumChildrenCount: billing.premiumChildrenCount,
      monthlyAmountCents: billing.monthlyAmountCents,
      cancelAtPeriodEnd: isPendingCancellation(subscription) || scheduleInfo.cancelAtPeriodEnd,
      pendingRemovalChildrenIds: scheduleInfo.pendingRemovalChildrenIds,
      scheduledChildrenCount: scheduleInfo.scheduledChildrenCount,
      scheduledMonthlyAmountCents: scheduleInfo.scheduledMonthlyAmountCents,
      hasScheduledChanges: scheduleInfo.hasScheduledChanges,
    };
  } catch {
    return null;
  }
}

async function extractScheduleInfo(subscription: Stripe.Subscription): Promise<{
  hasScheduledChanges: boolean;
  cancelAtPeriodEnd: boolean;
  pendingRemovalChildrenIds?: string[];
  scheduledChildrenCount?: number;
  scheduledMonthlyAmountCents?: number;
}> {
  const scheduleId = getScheduleId(subscription.schedule);
  if (!scheduleId) {
    return { hasScheduledChanges: false, cancelAtPeriodEnd: false };
  }

  const schedule = await requireStripe().subscriptionSchedules.retrieve(scheduleId, {
    expand: ['phases.items.price'],
  });

  if (schedule.end_behavior === 'cancel') {
    return {
      hasScheduledChanges: true,
      cancelAtPeriodEnd: true,
      pendingRemovalChildrenIds: parseChildrenIdsFromMetadata(schedule.metadata?.removedChildrenIds),
      scheduledChildrenCount: 0,
      scheduledMonthlyAmountCents: 0,
    };
  }

  if (schedule.metadata?.pendingAction === SCHEDULE_ACTION.REMOVE_CHILDREN) {
    const secondPhase = schedule.phases[1];
    const scheduledChildrenCount = secondPhase?.metadata?.childrenCount
      ? parseInt(secondPhase.metadata.childrenCount, 10)
      : undefined;

    const scheduledMonthlyAmountCents = calculateMonthlyAmountFromPhase(secondPhase);

    return {
      hasScheduledChanges: true,
      cancelAtPeriodEnd: false,
      pendingRemovalChildrenIds: parseChildrenIdsFromMetadata(schedule.metadata.removedChildrenIds),
      scheduledChildrenCount,
      scheduledMonthlyAmountCents,
    };
  }

  return { hasScheduledChanges: false, cancelAtPeriodEnd: false };
}

function calculateMonthlyAmountFromPhase(
  phase: Stripe.SubscriptionSchedule.Phase | undefined
): number | undefined {
  if (!phase) return undefined;

  let amount = 0;
  for (const item of phase.items) {
    const price = item.price as Stripe.Price;
    if (price?.unit_amount) {
      amount += price.unit_amount * (item.quantity ?? 1);
    }
  }
  return amount;
}

// ============================================
// Prorata Calculation
// ============================================

export async function calculateAddChildrenProrata(
  parentId: string,
  newChildrenCount: number
): Promise<ProrataCalculation> {
  const planConfig = await getPremiumPlanConfig();
  if (!planConfig) {
    throw new NoPlanConfiguredError();
  }

  const [billing] = await db
    .select()
    .from(familyBilling)
    .where(eq(familyBilling.parentId, parentId))
    .limit(1);

  if (!billing?.stripeSubscriptionId) {
    throw new NoSubscriptionError();
  }

  const subscription = await requireStripe().subscriptions.retrieve(billing.stripeSubscriptionId, {
    expand: ['items.data', 'schedule'],
  });

  const period = extractPeriodFromItem(subscription.items.data[0]);
  const periodStart = new Date(period.start * 1000);
  const periodEnd = new Date(period.end * 1000);
  const now = new Date();

  const totalDaysInPeriod = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = Math.max(
    0,
    Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const pricePerChildCents = planConfig.priceAdditionalChildCents;

  const prorataAmountCents = Math.round(
    (pricePerChildCents * daysRemaining / totalDaysInPeriod) * newChildrenCount
  );

  let baseChildrenCount = billing.premiumChildrenCount;

  if (subscription.schedule) {
    const scheduleId =
      typeof subscription.schedule === 'string'
        ? subscription.schedule
        : subscription.schedule.id;

    const schedule = await requireStripe().subscriptionSchedules.retrieve(scheduleId, {
      expand: ['phases.items.price'],
    });

    const secondPhase = schedule.phases[1];
    if (secondPhase) {
      let scheduledChildren = 0;
      for (const item of secondPhase.items) {
        const price = typeof item.price === 'string' ? item.price : item.price?.id;
        if (price === planConfig.priceIdFirstChild) {
          scheduledChildren += 1;
        } else if (price === planConfig.priceIdAdditionalChild) {
          scheduledChildren += item.quantity ?? 0;
        }
      }
      baseChildrenCount = scheduledChildren;
      logger.debug(`[Stripe] Schedule detected - future children count: ${scheduledChildren}`, { operation: 'stripe:prorata:schedule', scheduledChildren });
    }
  } else if (subscription.cancel_at_period_end) {
    baseChildrenCount = 0;
    logger.debug('[Stripe] Subscription pending cancellation - base children: 0', { operation: 'stripe:prorata:cancel' });
  }

  const newTotalChildren = baseChildrenCount + newChildrenCount;
  const newMonthlyAmountCents = calculateMonthlyPrice(newTotalChildren, planConfig);

  return {
    prorataAmountCents,
    prorataAmount: `${(prorataAmountCents / 100).toFixed(2)}€`,
    daysRemaining,
    totalDaysInPeriod,
    currentPeriodEnd: periodEnd,
    newMonthlyAmountCents,
    newMonthlyAmount: `${(newMonthlyAmountCents / 100).toFixed(2)}€`,
    pricePerChildCents,
  };
}

// ============================================
// Webhook
// ============================================

export async function constructWebhookEventAsync(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Promise<Stripe.Event> {
  return await requireStripe().webhooks.constructEventAsync(payload, signature, webhookSecret);
}
