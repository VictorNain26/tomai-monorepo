/**
 * Stripe Configuration
 * SDK instance and plan cache management
 *
 * Best Practice 2025:
 * - Production: Stripe REQUIRED (throw error if missing)
 * - Development: Stripe OPTIONAL (warning + disabled features)
 */

import Stripe from 'stripe';
import { db } from '../../db/connection';
import { subscriptionPlans } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { PremiumPlanConfig } from './types';
import { logger } from '../observability';

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;

// Production: Stripe is REQUIRED
if (isProduction && !hasStripeKey) {
  throw new Error('STRIPE_SECRET_KEY is required in production');
}

// Development: Stripe is OPTIONAL
if (!hasStripeKey) {
  logger.warn('Stripe not configured - payment features disabled', {
    operation: 'stripe:config:skip',
    environment: process.env.NODE_ENV ?? 'development',
    impact: 'Checkout, subscriptions, and webhooks will not work'
  });
}

/**
 * Stripe SDK instance (null if not configured in development)
 */
export const stripe: Stripe | null = hasStripeKey
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
      appInfo: {
        name: 'TomAI Server',
        version: '2.0.0',
        url: 'https://tomia.fr',
      },
    })
  : null;

/**
 * Check if Stripe is available
 */
export function isStripeEnabled(): boolean {
  return stripe !== null;
}

/**
 * Get Stripe instance with non-null assertion
 * Use in internal modules that are only loaded when Stripe is enabled
 * Throws if called when Stripe is not configured
 */
export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. This function should only be called when Stripe is enabled.');
  }
  return stripe;
}

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
