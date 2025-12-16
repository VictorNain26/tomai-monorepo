/**
 * Stripe Service Helpers
 * Pure utility functions for subscription operations
 */

import type Stripe from 'stripe';
import type { SubscriptionPeriod, PremiumPlanConfig } from './types';

/** Default period duration in seconds (30 days) */
export const DEFAULT_PERIOD_SECONDS = 30 * 24 * 60 * 60;

/** Billing statuses */
export const BILLING_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const;

/** Schedule actions stored in metadata */
export const SCHEDULE_ACTION = {
  REMOVE_CHILDREN: 'remove_children',
  CANCEL_ALL: 'cancel_all',
} as const;

/**
 * Extract period from subscription item (avoids repeated type casting)
 */
export function extractPeriodFromItem(item: Stripe.SubscriptionItem | undefined): SubscriptionPeriod {
  if (!item) return { start: 0, end: 0 };
  // Stripe types don't include current_period_* on items but the API returns them
  const itemWithPeriod = item as Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    start: itemWithPeriod.current_period_start ?? 0,
    end: itemWithPeriod.current_period_end ?? 0,
  };
}

/**
 * Get period end with fallback to default duration
 */
export function getPeriodEndWithFallback(period: SubscriptionPeriod): number {
  return period.end || Math.floor(Date.now() / 1000) + DEFAULT_PERIOD_SECONDS;
}

/**
 * Get period start with fallback to now
 */
export function getPeriodStartWithFallback(period: SubscriptionPeriod): number {
  return period.start || Math.floor(Date.now() / 1000);
}

/**
 * Safely parse JSON array from metadata string
 */
export function parseChildrenIdsFromMetadata(jsonString: string | undefined): string[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get schedule ID from subscription (handles both string and object)
 */
export function getScheduleId(schedule: string | Stripe.SubscriptionSchedule | null): string | null {
  if (!schedule) return null;
  return typeof schedule === 'string' ? schedule : schedule.id;
}

/**
 * Count children from Stripe subscription items
 */
export function countChildrenFromItems(
  items: Stripe.SubscriptionItem[],
  planConfig: PremiumPlanConfig
): { firstChild: number; additional: number; total: number } {
  const firstChildItem = items.find(item => item.price.id === planConfig.priceIdFirstChild);
  const additionalItem = items.find(item => item.price.id === planConfig.priceIdAdditionalChild);

  const firstChild = firstChildItem ? 1 : 0;
  const additional = additionalItem?.quantity ?? 0;

  return {
    firstChild,
    additional,
    total: firstChild + additional,
  };
}

/**
 * Build subscription items array for a given children count
 */
export function buildSubscriptionItems(
  childrenCount: number,
  planConfig: PremiumPlanConfig
): Stripe.SubscriptionScheduleCreateParams.Phase.Item[] {
  if (childrenCount <= 0) return [];

  const items: Stripe.SubscriptionScheduleCreateParams.Phase.Item[] = [
    { price: planConfig.priceIdFirstChild, quantity: 1 },
  ];

  const additionalCount = childrenCount - 1;
  if (additionalCount > 0) {
    items.push({ price: planConfig.priceIdAdditionalChild, quantity: additionalCount });
  }

  return items;
}

/**
 * Extract current items from schedule phase for reuse
 */
export function extractCurrentItemsFromPhase(
  phase: Stripe.SubscriptionSchedule.Phase | undefined
): Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] {
  if (!phase?.items) return [];
  return phase.items.map(item => ({
    price: typeof item.price === 'string' ? item.price : item.price?.id ?? '',
    quantity: item.quantity ?? 1,
  }));
}

/**
 * Check if subscription is pending cancellation (any form)
 */
export function isPendingCancellation(subscription: Stripe.Subscription): boolean {
  return subscription.cancel_at_period_end || !!subscription.cancel_at;
}

/**
 * Calculate monthly price for given number of children
 * Formula: 15€ (first) + 5€ × (additional children)
 */
export function calculateMonthlyPrice(childrenCount: number, planConfig: PremiumPlanConfig): number {
  if (childrenCount <= 0) return 0;
  const firstChildPrice = planConfig.priceFirstChildCents;
  const additionalChildrenPrice = Math.max(0, childrenCount - 1) * planConfig.priceAdditionalChildCents;
  return firstChildPrice + additionalChildrenPrice;
}
