/**
 * Subscription Routes Module
 *
 * Family-based subscription management for TomAI with per-child pricing:
 * - First child: 15€/month
 * - Additional children: +5€/month each (with proration)
 *
 * Best Practice 2025:
 * - Production/Staging: Stripe REQUIRED (routes fully functional)
 * - Development: Stripe OPTIONAL (empty plugins when not configured)
 *
 * Only PARENTS can manage subscriptions.
 */

import { Elysia } from 'elysia';
import { isStripeEnabled } from '../../lib/stripe/config.js';
import { logger } from '../../lib/observability.js';

// Conditional exports: real routes or empty plugins
const stripeEnabled = isStripeEnabled();

if (!stripeEnabled) {
  logger.info('Subscription routes disabled - Stripe not configured', {
    operation: 'subscription:routes:skip',
  });
}

// Export real routes or empty Elysia plugins
export const checkoutRoutes = stripeEnabled
  ? (await import('./checkout.routes.js')).checkoutRoutes
  : new Elysia({ prefix: '/api/subscription' });

export const childrenRoutes = stripeEnabled
  ? (await import('./children.routes.js')).childrenRoutes
  : new Elysia({ prefix: '/api/subscription' });

export const statusRoutes = stripeEnabled
  ? (await import('./status.routes.js')).statusRoutes
  : new Elysia({ prefix: '/api/subscription' });

export const lifecycleRoutes = stripeEnabled
  ? (await import('./lifecycle.routes.js')).lifecycleRoutes
  : new Elysia({ prefix: '/api/subscription' });

// Re-export helpers (always available, no Stripe dependency)
export {
  getChildrenForParent,
  formatSubscriptionResponse,
} from './helpers.js';
