/**
 * RevenueCat Webhook Routes - Handle RevenueCat Events
 *
 * Webhook endpoint for RevenueCat subscription lifecycle events.
 * Handles iOS App Store and Google Play subscriptions.
 *
 * Environment variables:
 * - REVENUECAT_WEBHOOK_AUTH: Authorization header value for webhook security
 *
 * @see https://www.revenuecat.com/docs/integrations/webhooks
 */

import { Elysia } from 'elysia';
import { logger } from '../lib/observability';

// ============================================
// Configuration
// ============================================

const WEBHOOK_AUTH = process.env.REVENUECAT_WEBHOOK_AUTH ?? '';
const isWebhookEnabled = !!WEBHOOK_AUTH;

// Log webhook status at startup
if (!isWebhookEnabled) {
  logger.info('RevenueCat webhooks disabled - REVENUECAT_WEBHOOK_AUTH not configured', {
    operation: 'revenuecat:webhook:skip',
  });
}

// ============================================
// Conditional Export
// ============================================

/**
 * RevenueCat Webhook Routes
 * Returns empty plugin if RevenueCat is not configured
 */
export const revenuecatWebhookRoutes = isWebhookEnabled
  ? (await import('./revenuecat-webhook.handler.js')).createRevenueCatWebhookRoutes()
  : new Elysia({ prefix: '/webhooks/revenuecat' });
