/**
 * Stripe Subscription Lifecycle
 *
 * Handles subscription cancellation, resumption, and pending changes.
 */

import type Stripe from 'stripe';
import { db } from '../../db/connection';
import { familyBilling, userSubscriptions } from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';

import { stripe, getPremiumPlanConfig, getPremiumPlanId } from './config';
import {
  NoPlanConfiguredError,
  NoSubscriptionError,
  NoPendingChangesError,
  SubscriptionFullyCanceledError,
} from './errors';
import type { PremiumPlanConfig, SubscriptionInfo, FamilyBillingRecord } from './types';
import {
  BILLING_STATUS,
  SCHEDULE_ACTION,
  DEFAULT_PERIOD_SECONDS,
  extractPeriodFromItem,
  parseChildrenIdsFromMetadata,
  getScheduleId,
  buildSubscriptionItems,
  extractCurrentItemsFromPhase,
} from './helpers';
import {
  getBilling,
  setBillingActive,
  setBillingCanceled,
  clearBillingSubscription,
} from './billing';
import { cancelPendingSchedule } from './children';
import { getSubscriptionStatus } from './status';
import { logger } from '../observability';

// ============================================
// Cancel via Schedule
// ============================================

export async function cancelSubscriptionViaSchedule(
  parentId: string,
  billing: FamilyBillingRecord,
  subscription: Stripe.Subscription,
  allRemovedChildrenIds: string[]
): Promise<SubscriptionInfo> {
  const planConfig = await getPremiumPlanConfig();
  if (!planConfig) {
    throw new NoPlanConfiguredError();
  }

  const firstChildItem = subscription.items.data.find(
    (item) => item.price.id === planConfig.priceIdFirstChild
  );
  const period = extractPeriodFromItem(firstChildItem);
  const periodEnd = period.end || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const periodStart = period.start || Math.floor(Date.now() / 1000);

  const currentItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] =
    subscription.items.data.map((item) => ({
      price: item.price.id,
      quantity: item.quantity ?? 1,
    }));

  if (subscription.schedule) {
    const scheduleId = typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule.id;
    const existingSchedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    const scheduleStartDate = existingSchedule.phases[0]?.start_date ?? Math.floor(Date.now() / 1000);

    await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: 'cancel',
      phases: [
        {
          items: currentItems,
          start_date: scheduleStartDate,
          end_date: periodEnd,
          proration_behavior: 'none',
        },
      ],
      metadata: {
        parentId,
        pendingAction: 'cancel_all',
        removedChildrenIds: JSON.stringify(allRemovedChildrenIds),
      },
    });

    logger.info(`[Stripe] Updated schedule ${scheduleId} with end_behavior: 'cancel' for parent ${parentId}`, { operation: 'stripe:schedule:update', parentId, scheduleId });
  } else {
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscription.id,
    });

    const scheduleStartDate = schedule.phases[0]?.start_date ?? Math.floor(Date.now() / 1000);

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'cancel',
      phases: [
        {
          items: currentItems,
          start_date: scheduleStartDate,
          end_date: periodEnd,
          proration_behavior: 'none',
        },
      ],
      metadata: {
        parentId,
        pendingAction: 'cancel_all',
        removedChildrenIds: JSON.stringify(allRemovedChildrenIds),
      },
    });

    logger.info(`[Stripe] Created schedule ${schedule.id} with end_behavior: 'cancel' for parent ${parentId}`, { operation: 'stripe:schedule:create', parentId, scheduleId: schedule.id });
  }

  await db
    .update(familyBilling)
    .set({ billingStatus: 'canceled', updatedAt: new Date() })
    .where(eq(familyBilling.parentId, parentId));

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    premiumChildrenCount: billing.premiumChildrenCount,
    monthlyAmountCents: billing.monthlyAmountCents,
    cancelAtPeriodEnd: true,
    pendingRemovalChildrenIds: allRemovedChildrenIds,
    scheduledChildrenCount: 0,
    scheduledMonthlyAmountCents: 0,
    hasScheduledChanges: true,
  };
}

// ============================================
// Cancel Subscription
// ============================================

export async function cancelSubscription(parentId: string): Promise<SubscriptionInfo> {
  const billing = await getBilling(parentId);
  if (!billing?.stripeSubscriptionId) throw new NoSubscriptionError();

  const subscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId, {
    expand: ['items.data'],
  });

  if (subscription.status === 'canceled') {
    await clearBillingSubscription(parentId);
    return buildCanceledSubscriptionInfo(subscription);
  }

  if (subscription.cancel_at_period_end) {
    return buildSubscriptionInfo(subscription, billing, { cancelAtPeriodEnd: true });
  }

  if (subscription.schedule) {
    const allChildrenIds = parseChildrenIdsFromMetadata(subscription.metadata?.childrenIds);
    return cancelSubscriptionViaSchedule(parentId, billing, subscription, allChildrenIds);
  }

  const updated = await stripe.subscriptions.update(billing.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await setBillingCanceled(parentId);

  return buildSubscriptionInfo(updated, billing, { cancelAtPeriodEnd: true });
}

// ============================================
// Cancel Pending Removal
// ============================================

export async function cancelPendingRemoval(
  parentId: string,
  childId?: string
): Promise<SubscriptionInfo> {
  const planConfig = await getPremiumPlanConfig();
  if (!planConfig) throw new NoPlanConfiguredError();

  const billing = await getBilling(parentId);
  if (!billing?.stripeSubscriptionId) throw new NoSubscriptionError();

  const subscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId, {
    expand: ['items.data'],
  });

  const scheduleId = getScheduleId(subscription.schedule);
  if (!scheduleId) {
    throw new NoPendingChangesError();
  }

  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  const pendingRemovalIds = parseChildrenIdsFromMetadata(schedule.metadata?.removedChildrenIds);

  logger.info(`[Stripe] cancelPendingRemoval: schedule ${scheduleId}`, { operation: 'stripe:schedule:cancel-removal', scheduleId, endBehavior: schedule.end_behavior, pendingRemovalIds, childId });

  const shouldReleaseEntireSchedule = !childId || pendingRemovalIds.length <= 1;

  if (shouldReleaseEntireSchedule) {
    await releaseScheduleAndReactivate(scheduleId, parentId, billing);
    logger.info(`[Stripe] Released schedule ${scheduleId} for parent ${parentId} - all children reactivated`, { operation: 'stripe:schedule:release', parentId, scheduleId });
    return getSubscriptionStatus(parentId) as Promise<SubscriptionInfo>;
  }

  const newPendingRemovalIds = pendingRemovalIds.filter(id => id !== childId);

  if (newPendingRemovalIds.length === 0) {
    await releaseScheduleAndReactivate(scheduleId, parentId, billing);
    logger.info(`[Stripe] Released schedule ${scheduleId} for parent ${parentId} - last child reactivated`, { operation: 'stripe:schedule:release', parentId, scheduleId });
  } else {
    await updateScheduleForPartialReactivation(
      schedule,
      planConfig,
      parentId,
      billing.premiumChildrenCount,
      newPendingRemovalIds,
      childId
    );
  }

  return getSubscriptionStatus(parentId) as Promise<SubscriptionInfo>;
}

async function releaseScheduleAndReactivate(
  scheduleId: string,
  parentId: string,
  billing: FamilyBillingRecord
): Promise<void> {
  await cancelPendingSchedule(scheduleId, billing.stripeSubscriptionId ?? undefined);

  if (billing.billingStatus === BILLING_STATUS.CANCELED) {
    await setBillingActive(parentId);
  }
}

async function updateScheduleForPartialReactivation(
  schedule: Stripe.SubscriptionSchedule,
  planConfig: PremiumPlanConfig,
  parentId: string,
  currentTotalChildren: number,
  newPendingRemovalIds: string[],
  reactivatedChildId?: string
): Promise<void> {
  const newChildrenCountNextPeriod = currentTotalChildren - newPendingRemovalIds.length;
  const newPhaseItems = buildSubscriptionItems(newChildrenCountNextPeriod, planConfig);

  const currentPhase = schedule.phases[0];
  const scheduleStartDate = currentPhase?.start_date ?? Math.floor(Date.now() / 1000);
  const periodEnd = currentPhase?.end_date ?? Math.floor(Date.now() / 1000) + DEFAULT_PERIOD_SECONDS;

  const currentItems = extractCurrentItemsFromPhase(currentPhase);
  const endBehavior: 'release' | 'cancel' = newChildrenCountNextPeriod > 0 ? 'release' : 'cancel';

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: endBehavior,
    phases: [
      {
        items: currentItems,
        start_date: scheduleStartDate,
        end_date: periodEnd,
        proration_behavior: 'none',
      },
      {
        items: newPhaseItems as Stripe.SubscriptionScheduleUpdateParams.Phase.Item[],
        start_date: periodEnd,
        proration_behavior: 'none',
        metadata: {
          parentId,
          childrenCount: newChildrenCountNextPeriod.toString(),
          removedChildrenIds: JSON.stringify(newPendingRemovalIds),
          action: SCHEDULE_ACTION.REMOVE_CHILDREN,
        },
      },
    ],
    metadata: {
      parentId,
      pendingAction: SCHEDULE_ACTION.REMOVE_CHILDREN,
      removedChildrenIds: JSON.stringify(newPendingRemovalIds),
    },
  });

  logger.info(`[Stripe] Updated schedule ${schedule.id} for parent ${parentId} - child ${reactivatedChildId} reactivated, ${newPendingRemovalIds.length} still pending`, { operation: 'stripe:schedule:update', parentId, scheduleId: schedule.id, reactivatedChildId, pendingCount: newPendingRemovalIds.length });
}

// ============================================
// Resume Subscription
// ============================================

export async function resumeSubscription(parentId: string): Promise<SubscriptionInfo> {
  const billing = await getBilling(parentId);
  if (!billing?.stripeSubscriptionId) throw new NoSubscriptionError();

  const currentSub = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId, {
    expand: ['items.data'],
  });

  if (currentSub.status === 'canceled') {
    await clearBillingSubscription(parentId);
    throw new SubscriptionFullyCanceledError();
  }

  await releaseScheduleIfExists(currentSub, parentId);

  const subscription = await stripe.subscriptions.update(billing.stripeSubscriptionId, {
    cancel_at_period_end: false,
    cancel_at: '',
  } as Stripe.SubscriptionUpdateParams);

  await setBillingActive(parentId);

  await restoreChildrenFromMetadata(subscription);

  logger.info(`[Stripe] Resumed subscription for parent ${parentId}`, { operation: 'stripe:subscription:resume', parentId });
  return buildSubscriptionInfo(subscription, billing, { cancelAtPeriodEnd: false });
}

async function releaseScheduleIfExists(
  subscription: Stripe.Subscription,
  parentId: string
): Promise<void> {
  const scheduleId = getScheduleId(subscription.schedule);
  if (!scheduleId) return;

  await stripe.subscriptionSchedules.release(scheduleId);
  logger.info(`[Stripe] Released schedule ${scheduleId} for parent ${parentId}`, { operation: 'stripe:schedule:release', parentId, scheduleId });
}

async function restoreChildrenFromMetadata(subscription: Stripe.Subscription): Promise<void> {
  const premiumPlanId = await getPremiumPlanId();
  if (!premiumPlanId || !subscription.metadata?.childrenIds) return;

  const subscribedChildrenIds = parseChildrenIdsFromMetadata(subscription.metadata.childrenIds);
  if (subscribedChildrenIds.length === 0) return;

  await db
    .update(userSubscriptions)
    .set({
      planId: premiumPlanId,
      status: 'active',
      updatedAt: new Date(),
    })
    .where(inArray(userSubscriptions.userId, subscribedChildrenIds));

  logger.info(`[Stripe] Restored ${subscribedChildrenIds.length} children to premium`, { operation: 'stripe:children:restore', count: subscribedChildrenIds.length });
}

// ============================================
// Helper builders
// ============================================

function buildSubscriptionInfo(
  subscription: Stripe.Subscription,
  billing: FamilyBillingRecord,
  overrides: Partial<SubscriptionInfo> = {}
): SubscriptionInfo {
  const period = extractPeriodFromItem(subscription.items.data[0]);
  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodStart: new Date(period.start * 1000),
    currentPeriodEnd: new Date(period.end * 1000),
    premiumChildrenCount: billing.premiumChildrenCount,
    monthlyAmountCents: billing.monthlyAmountCents,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function buildCanceledSubscriptionInfo(subscription: Stripe.Subscription): SubscriptionInfo {
  const period = extractPeriodFromItem(subscription.items.data[0]);
  return {
    subscriptionId: subscription.id,
    status: 'canceled',
    currentPeriodStart: new Date(period.start * 1000),
    currentPeriodEnd: new Date(period.end * 1000),
    premiumChildrenCount: 0,
    monthlyAmountCents: 0,
    cancelAtPeriodEnd: true,
  };
}
