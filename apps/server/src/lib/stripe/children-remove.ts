import type Stripe from 'stripe';
import { requireStripe, getPremiumPlanConfig } from './config';
import {
  NoPlanConfiguredError,
  NoSubscriptionError,
  SubscriptionFullyCanceledError,
} from './errors';
import type { SubscriptionInfo } from './types';
import {
  extractPeriodFromItem,
  getPeriodEndWithFallback,
  getPeriodStartWithFallback,
  parseChildrenIdsFromMetadata,
  getScheduleId,
  countChildrenFromItems,
  buildSubscriptionItems,
  calculateMonthlyPrice,
} from './helpers';
import { getBilling, clearBillingSubscription } from './billing';
import { cancelSubscriptionViaSchedule } from './lifecycle';
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

// ============================================
// Remove Children
// ============================================

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
