/**
 * Stripe Children Management
 *
 * Handles adding and removing children from subscriptions.
 */

import type Stripe from 'stripe';
import { requireStripe, getPremiumPlanConfig } from './config';
import {
  NoPlanConfiguredError,
  NoSubscriptionError,
  SubscriptionFullyCanceledError,
} from './errors';
import type { PremiumPlanConfig, SubscriptionInfo } from './types';
import {
  SCHEDULE_ACTION,
  extractPeriodFromItem,
  getPeriodEndWithFallback,
  getPeriodStartWithFallback,
  parseChildrenIdsFromMetadata,
  getScheduleId,
  countChildrenFromItems,
  buildSubscriptionItems,
  isPendingCancellation,
  calculateMonthlyPrice,
} from './helpers';
import {
  getBilling,
  clearBillingSubscription,
  updateBillingSubscription,
} from './billing';
import { logger } from '../observability';

// ============================================
// Private helpers
// ============================================

async function getSubscriptionWithItems(subscriptionId: string): Promise<Stripe.Subscription> {
  return requireStripe().subscriptions.retrieve(subscriptionId, {
    expand: ['items.data'],
  });
}

async function handleFullyCanceledSubscription(
  subscription: Stripe.Subscription,
  parentId: string
): Promise<boolean> {
  if (subscription.status !== 'canceled') return false;
  await clearBillingSubscription(parentId);
  return true;
}

async function clearSubscriptionCancellation(subscriptionId: string): Promise<Stripe.Subscription> {
  return requireStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
    cancel_at: '',
  } as Stripe.SubscriptionUpdateParams);
}

function buildAddChildrenUpdateItems(
  currentItems: Stripe.SubscriptionItem[],
  newTotalChildren: number,
  planConfig: PremiumPlanConfig
): Stripe.SubscriptionUpdateParams.Item[] {
  const additionalItem = currentItems.find(i => i.price.id === planConfig.priceIdAdditionalChild);
  const newAdditionalCount = Math.max(0, newTotalChildren - 1);
  const updateItems: Stripe.SubscriptionUpdateParams.Item[] = [];

  if (additionalItem) {
    updateItems.push({ id: additionalItem.id, quantity: newAdditionalCount });
  } else if (newAdditionalCount > 0) {
    updateItems.push({ price: planConfig.priceIdAdditionalChild, quantity: newAdditionalCount });
  }

  return updateItems;
}

async function cancelPendingSchedule(scheduleId: string, subscriptionId?: string): Promise<void> {
  try {
    const schedule = await requireStripe().subscriptionSchedules.retrieve(scheduleId);
    const subId = subscriptionId ?? (schedule.subscription as string | null);

    await requireStripe().subscriptionSchedules.release(scheduleId);
    logger.info(`[Stripe] Released schedule ${scheduleId}`, { operation: 'stripe:schedule:release', scheduleId });

    if (subId && schedule.end_behavior === 'cancel') {
      await requireStripe().subscriptions.update(subId, {
        cancel_at: '',
      } as Stripe.SubscriptionUpdateParams);
      logger.info(`[Stripe] Cleared cancel_at on subscription ${subId}`, { operation: 'stripe:subscription:clear-cancel', subscriptionId: subId });
    }
  } catch (error) {
    logger.error(`[Stripe] Failed to release schedule ${scheduleId}`, {
      operation: 'stripe:schedule:release',
      scheduleId,
      _error: error instanceof Error ? error.message : String(error),
      severity: 'medium' as const
    });
  }
}

async function createDeferredRemovalSchedule(params: {
  subscription: Stripe.Subscription;
  parentId: string;
  periodEnd: number;
  removedChildrenIds: string[];
  remainingChildrenIds: string[];
  planConfig: PremiumPlanConfig;
}): Promise<Stripe.SubscriptionSchedule> {
  const { subscription, parentId, periodEnd, removedChildrenIds, remainingChildrenIds, planConfig } = params;

  const nextPhaseItems = buildSubscriptionItems(remainingChildrenIds.length, planConfig);

  const schedule = await requireStripe().subscriptionSchedules.create({
    from_subscription: subscription.id,
  });

  const scheduleStartDate = schedule.phases[0]?.start_date ?? Math.floor(Date.now() / 1000);
  const currentItems = subscription.items.data.map(item => ({
    price: item.price.id,
    quantity: item.quantity ?? 1,
  }));

  return requireStripe().subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    phases: [
      {
        items: currentItems,
        start_date: scheduleStartDate,
        end_date: periodEnd,
        proration_behavior: 'none',
      },
      {
        items: nextPhaseItems,
        start_date: periodEnd,
        proration_behavior: 'none',
        metadata: {
          parentId,
          childrenIds: JSON.stringify(remainingChildrenIds),
          childrenCount: remainingChildrenIds.length.toString(),
          removedChildrenIds: JSON.stringify(removedChildrenIds),
          action: SCHEDULE_ACTION.REMOVE_CHILDREN,
        },
      },
    ],
    metadata: {
      parentId,
      pendingAction: SCHEDULE_ACTION.REMOVE_CHILDREN,
      removedChildrenIds: JSON.stringify(removedChildrenIds),
    },
  });
}

// ============================================
// Add Children
// ============================================

export async function addChildrenToSubscription(
  parentId: string,
  newChildrenIds: string[]
): Promise<SubscriptionInfo> {
  const planConfig = await getPremiumPlanConfig();
  if (!planConfig) throw new NoPlanConfiguredError();

  const billing = await getBilling(parentId);
  if (!billing?.stripeSubscriptionId) throw new NoSubscriptionError();

  const subscription = await getSubscriptionWithItems(billing.stripeSubscriptionId);

  if (await handleFullyCanceledSubscription(subscription, parentId)) {
    throw new SubscriptionFullyCanceledError();
  }

  const existingChildrenIds = parseChildrenIdsFromMetadata(subscription.metadata?.childrenIds);
  const wasPendingCancellation = isPendingCancellation(subscription);

  if (wasPendingCancellation) {
    await clearSubscriptionCancellation(billing.stripeSubscriptionId);
    logger.info(`[Stripe] Resumed canceled-pending subscription for parent ${parentId}`, { operation: 'stripe:subscription:resume', parentId });
  }

  const scheduleId = getScheduleId(subscription.schedule);
  if (scheduleId) {
    await cancelPendingSchedule(scheduleId);
  }

  const childrenCount = countChildrenFromItems(subscription.items.data, planConfig);
  const newTotalChildren = childrenCount.total + newChildrenIds.length;

  const updateItems = buildAddChildrenUpdateItems(
    subscription.items.data,
    newTotalChildren,
    planConfig
  );

  const allChildrenIds = [...new Set([...existingChildrenIds, ...newChildrenIds])];
  const updatedSubscription = await requireStripe().subscriptions.update(billing.stripeSubscriptionId, {
    items: updateItems,
    proration_behavior: 'always_invoice',
    metadata: {
      parentId,
      childrenIds: JSON.stringify(allChildrenIds),
      childrenCount: newTotalChildren.toString(),
    },
  });

  const firstChildItem = subscription.items.data.find(i => i.price.id === planConfig.priceIdFirstChild);
  const period = extractPeriodFromItem(firstChildItem);
  const periodEnd = getPeriodEndWithFallback(period);

  let hasScheduledChanges = false;
  let pendingRemovalChildrenIds: string[] = [];

  if (wasPendingCancellation && existingChildrenIds.length > 0) {
    await createDeferredRemovalSchedule({
      subscription: updatedSubscription,
      parentId,
      periodEnd,
      removedChildrenIds: existingChildrenIds,
      remainingChildrenIds: newChildrenIds,
      planConfig,
    });
    hasScheduledChanges = true;
    pendingRemovalChildrenIds = existingChildrenIds;
    logger.info(`[Stripe] Created schedule for parent ${parentId}: old children removed at period end`, { operation: 'stripe:schedule:create', parentId });
  }

  const currentMonthlyAmount = calculateMonthlyPrice(newTotalChildren, planConfig);
  const nextPeriodMonthlyAmount = wasPendingCancellation
    ? calculateMonthlyPrice(newChildrenIds.length, planConfig)
    : currentMonthlyAmount;

  await updateBillingSubscription(parentId, {
    premiumChildrenCount: newTotalChildren,
    monthlyAmountCents: currentMonthlyAmount,
  });

  logger.info(`[Stripe] Added ${newChildrenIds.length} children for parent ${parentId}: ${childrenCount.total} -> ${newTotalChildren}`, { operation: 'stripe:children:add', parentId, count: newChildrenIds.length });

  return {
    subscriptionId: updatedSubscription.id,
    status: updatedSubscription.status,
    currentPeriodStart: new Date(period.start * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    premiumChildrenCount: newTotalChildren,
    monthlyAmountCents: currentMonthlyAmount,
    cancelAtPeriodEnd: false,
    hasScheduledChanges,
    pendingRemovalChildrenIds: hasScheduledChanges ? pendingRemovalChildrenIds : undefined,
    scheduledChildrenCount: hasScheduledChanges ? newChildrenIds.length : undefined,
    scheduledMonthlyAmountCents: hasScheduledChanges ? nextPeriodMonthlyAmount : undefined,
  };
}

// ============================================
// Remove Children
// ============================================

async function getExistingPendingRemovalIds(subscription: Stripe.Subscription): Promise<string[]> {
  const scheduleId = getScheduleId(subscription.schedule);
  if (!scheduleId) return [];

  try {
    const schedule = await requireStripe().subscriptionSchedules.retrieve(scheduleId);
    return parseChildrenIdsFromMetadata(schedule.metadata?.removedChildrenIds);
  } catch {
    return [];
  }
}

async function createScheduleForRemoval(
  subscription: Stripe.Subscription,
  newPhaseItems: Stripe.SubscriptionScheduleCreateParams.Phase.Item[],
  periodEnd: number,
  parentId: string,
  newChildrenCount: number,
  removedChildrenIds: string[]
): Promise<Stripe.SubscriptionSchedule> {
  const schedule = await requireStripe().subscriptionSchedules.create({
    from_subscription: subscription.id,
  });

  const scheduleStartDate = schedule.phases[0]?.start_date ?? Math.floor(Date.now() / 1000);
  const currentItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] = subscription.items.data.map(
    (item) => ({
      price: item.price.id,
      quantity: item.quantity ?? 1,
    })
  );

  const updatedSchedule = await requireStripe().subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    phases: [
      {
        items: currentItems,
        start_date: scheduleStartDate,
        end_date: periodEnd,
        proration_behavior: 'none',
      },
      {
        items: newPhaseItems,
        start_date: periodEnd,
        proration_behavior: 'none',
        metadata: {
          parentId,
          childrenCount: newChildrenCount.toString(),
          removedChildrenIds: JSON.stringify(removedChildrenIds),
          action: 'remove_children',
        },
      },
    ],
    metadata: {
      parentId,
      pendingAction: 'remove_children',
      removedChildrenIds: JSON.stringify(removedChildrenIds),
    },
  });

  logger.info(`[Stripe] Created schedule ${schedule.id} for parent ${parentId} - removing ${removedChildrenIds.length} children at period end`, { operation: 'stripe:schedule:create', parentId, scheduleId: schedule.id, removedCount: removedChildrenIds.length });

  return updatedSchedule;
}

async function updateScheduleForRemoval(
  scheduleId: string,
  newPhaseItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[],
  periodEnd: number,
  parentId: string,
  newChildrenCount: number,
  removedChildrenIds: string[]
): Promise<Stripe.SubscriptionSchedule> {
  const currentSchedule = await requireStripe().subscriptionSchedules.retrieve(scheduleId);

  // SECURITY: Use Zod-validated parsing for metadata
  const existingRemovedIds = parseChildrenIdsFromMetadata(currentSchedule.metadata?.removedChildrenIds);

  const allRemovedChildrenIds = [...new Set([...existingRemovedIds, ...removedChildrenIds])];
  const currentPhase = currentSchedule.phases[0];
  const scheduleStartDate = currentPhase?.start_date ?? Math.floor(Date.now() / 1000);

  const currentItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] =
    currentPhase?.items?.map((item) => ({
      price: typeof item.price === 'string' ? item.price : item.price?.id ?? '',
      quantity: item.quantity ?? 1,
    })) ?? [];

  const updatedSchedule = await requireStripe().subscriptionSchedules.update(scheduleId, {
    end_behavior: 'release',
    phases: [
      {
        items: currentItems,
        start_date: scheduleStartDate,
        end_date: periodEnd,
        proration_behavior: 'none',
      },
      {
        items: newPhaseItems,
        start_date: periodEnd,
        proration_behavior: 'none',
        metadata: {
          parentId,
          childrenCount: newChildrenCount.toString(),
          removedChildrenIds: JSON.stringify(allRemovedChildrenIds),
          action: 'remove_children',
        },
      },
    ],
    metadata: {
      parentId,
      pendingAction: 'remove_children',
      removedChildrenIds: JSON.stringify(allRemovedChildrenIds),
    },
  });

  logger.info(`[Stripe] Updated schedule ${scheduleId} for parent ${parentId} - total ${allRemovedChildrenIds.length} children pending removal`, { operation: 'stripe:schedule:update', parentId, scheduleId, pendingRemovalCount: allRemovedChildrenIds.length });

  return updatedSchedule;
}

// Forward declaration - will be imported from lifecycle
import { cancelSubscriptionViaSchedule } from './lifecycle';

export async function removeChildrenFromSubscription(
  parentId: string,
  childrenIdsToRemove: string[]
): Promise<SubscriptionInfo> {
  const planConfig = await getPremiumPlanConfig();
  if (!planConfig) throw new NoPlanConfiguredError();

  const billing = await getBilling(parentId);
  if (!billing?.stripeSubscriptionId) throw new NoSubscriptionError();

  const subscription = await getSubscriptionWithItems(billing.stripeSubscriptionId);

  if (await handleFullyCanceledSubscription(subscription, parentId)) {
    throw new SubscriptionFullyCanceledError();
  }

  const childrenCount = countChildrenFromItems(subscription.items.data, planConfig);
  const existingPendingRemovalIds = await getExistingPendingRemovalIds(subscription);
  const allChildrenToRemove = [...new Set([...existingPendingRemovalIds, ...childrenIdsToRemove])];
  const newTotalChildren = Math.max(0, childrenCount.total - allChildrenToRemove.length);

  logger.info(`[Stripe] Scheduling removal for parent ${parentId}: ${childrenCount.total} total, ${allChildrenToRemove.length} to remove -> ${newTotalChildren} remaining`, { operation: 'stripe:children:remove', parentId, toRemove: allChildrenToRemove.length, remaining: newTotalChildren });

  if (newTotalChildren <= 0) {
    return cancelSubscriptionViaSchedule(parentId, billing, subscription, allChildrenToRemove);
  }

  const firstChildItem = subscription.items.data.find(i => i.price.id === planConfig.priceIdFirstChild);
  const period = extractPeriodFromItem(firstChildItem);
  const periodEnd = getPeriodEndWithFallback(period);
  const periodStart = getPeriodStartWithFallback(period);

  const scheduleItems = buildSubscriptionItems(newTotalChildren, planConfig) as Stripe.SubscriptionScheduleCreateParams.Phase.Item[];

  const scheduleId = getScheduleId(subscription.schedule);
  if (scheduleId) {
    await updateScheduleForRemoval(scheduleId, scheduleItems, periodEnd, parentId, newTotalChildren, allChildrenToRemove);
  } else {
    await createScheduleForRemoval(subscription, scheduleItems, periodEnd, parentId, newTotalChildren, allChildrenToRemove);
  }

  const scheduledMonthlyAmountCents = calculateMonthlyPrice(newTotalChildren, planConfig);

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    premiumChildrenCount: billing.premiumChildrenCount,
    monthlyAmountCents: billing.monthlyAmountCents,
    cancelAtPeriodEnd: false,
    pendingRemovalChildrenIds: allChildrenToRemove,
    scheduledChildrenCount: newTotalChildren,
    scheduledMonthlyAmountCents,
    hasScheduledChanges: true,
  };
}

// Export for use in other modules
export { cancelPendingSchedule };
