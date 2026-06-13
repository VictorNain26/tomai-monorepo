/**
 * Plan cache — in-memory cache for subscription plan IDs.
 *
 * Plans rarely change (seeded on bootstrap and edited only via migrations),
 * so a lazy-initialized module-level cache avoids a DB round-trip on every
 * billing mutation. Provider-agnostic: used by RevenueCat webhook handlers
 * and by BillingService.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { subscriptionPlans } from '../db/schema';
import { logger } from './observability';

const planCache = {
  freePlanId: null as string | null,
  premiumPlanId: null as string | null,
  initialized: false,
};

/**
 * Lazy-initialize the plan cache from the database.
 * Safe to call multiple times — no-op after first success.
 */
async function initPlanCache(): Promise<void> {
  if (planCache.initialized) return;

  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true));

  for (const plan of plans) {
    if (plan.name === 'free') {
      planCache.freePlanId = plan.id;
    } else if (plan.name === 'premium') {
      planCache.premiumPlanId = plan.id;
    }
  }

  planCache.initialized = true;
  logger.info('[PlanCache] Initialized', { operation: 'plan-cache:init' });
}

export async function getFreePlanId(): Promise<string | null> {
  await initPlanCache();
  return planCache.freePlanId;
}

export async function getPremiumPlanId(): Promise<string | null> {
  await initPlanCache();
  return planCache.premiumPlanId;
}
