/**
 * Stripe Webhook Routes - Handle Stripe Events
 *
 * Webhook endpoint for Stripe subscription lifecycle events
 * Updated for family-based billing with per-child pricing model
 *
 * Best Practice 2025:
 * - Production: STRIPE_WEBHOOK_SECRET required
 * - Development: Optional (empty plugin when not configured)
 *
 * Subscription Schedule Events:
 * - subscription_schedule.updated: Phase changed (e.g., child removal applied at period end)
 * - subscription_schedule.released: Schedule released back to regular subscription
 *
 * @see https://docs.stripe.com/webhooks
 * @see https://docs.stripe.com/billing/subscriptions/webhooks
 * @see https://docs.stripe.com/billing/subscriptions/subscription-schedules
 */

import { Elysia } from 'elysia';
import { isStripeEnabled } from '../lib/stripe';
import { logger } from '../lib/observability';

// ============================================
// Configuration
// ============================================

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const isWebhookEnabled = isStripeEnabled() && !!WEBHOOK_SECRET;

// Log webhook status at startup
if (!isWebhookEnabled) {
  logger.info('Stripe webhooks disabled - Stripe not configured', {
    operation: 'stripe:webhook:skip',
    hasStripe: isStripeEnabled(),
    hasWebhookSecret: !!WEBHOOK_SECRET,
  });
}

// ============================================
// Conditional Export
// ============================================

/**
 * Stripe Webhook Routes
 * Returns empty plugin if Stripe is not configured
 */
export const stripeWebhookRoutes = isWebhookEnabled
  ? (await import('./stripe-webhook.handler.js')).createWebhookRoutes(WEBHOOK_SECRET)
  : new Elysia({ prefix: '/webhooks/stripe' });
