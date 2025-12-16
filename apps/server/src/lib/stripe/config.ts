/**
 * Stripe Configuration
 * SDK instance and plan cache management
 */

import Stripe from 'stripe';
import { db } from '../../db/connection';
import { subscriptionPlans } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { PremiumPlanConfig } from './types';
import { logger } from '../observability';

// Environment validation
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required in environment');
}

/**
 * Stripe SDK instance with proper configuration
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
  appInfo: {
    name: 'TomAI Server',
    version: '2.0.0',
    url: 'https://tomia.fr',
  },
});

// ============================================
// Plan ID Cache
// ============================================

/** Cache for plan IDs (avoids DB queries on every request) */
const planCache = {
  freePlanId: null as string | null,
  premiumPlanId: null as string | null,
  premiumConfig: null as PremiumPlanConfig | null,
  initialized: false,
};

/**
 * Initialize plan cache from database
 * Called once on first use, plans rarely change
 */
export async function initPlanCache(): Promise<void> {
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
      if (plan.stripeProductId && plan.stripePriceIdFirstChild && plan.stripePriceIdAdditionalChild) {
        planCache.premiumConfig = {
          productId: plan.stripeProductId,
          priceIdFirstChild: plan.stripePriceIdFirstChild,
          priceIdAdditionalChild: plan.stripePriceIdAdditionalChild,
          priceFirstChildCents: plan.priceFirstChildCents,
          priceAdditionalChildCents: plan.priceAdditionalChildCents,
        };
      }
    }
  }

  planCache.initialized = true;
  logger.info('[Stripe] Plan cache initialized', { operation: 'stripe:cache:init' });
}

/**
 * Clear plan cache (call if plans are updated)
 */
export function clearPlanCache(): void {
  planCache.freePlanId = null;
  planCache.premiumPlanId = null;
  planCache.premiumConfig = null;
  planCache.initialized = false;
}

/**
 * Get free plan ID (cached)
 */
export async function getFreePlanId(): Promise<string | null> {
  await initPlanCache();
  return planCache.freePlanId;
}

/**
 * Get premium plan ID (cached)
 */
export async function getPremiumPlanId(): Promise<string | null> {
  await initPlanCache();
  return planCache.premiumPlanId;
}

/**
 * Get premium plan configuration (cached)
 */
export async function getPremiumPlanConfig(): Promise<PremiumPlanConfig | null> {
  await initPlanCache();
  if (!planCache.premiumConfig) {
    logger.error('[Stripe] Premium plan not properly configured in database', {
      operation: 'stripe:config:get',
      severity: 'high' as const,
      _error: 'Premium plan config missing'
    });
  }
  return planCache.premiumConfig;
}
