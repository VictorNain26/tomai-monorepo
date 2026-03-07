/**
 * Stripe Children Management - Add Children
 *
 * Handles adding children to subscriptions.
 * Removal logic is in ./children-remove.ts
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

// Re-export removeChildrenFromSubscription for consumers
export { removeChildrenFromSubscription } from './children-remove';

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

export async function cancelPendingSchedule(scheduleId: string, subscriptionId?: string): Promise<void> {
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
