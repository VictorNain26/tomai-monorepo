/**
 * RevenueCat Webhook Routes - Handle RevenueCat Events
 *
 * Webhook endpoint for RevenueCat subscription lifecycle events.
 * Handles iOS App Store and Google Play subscriptions.
 *
 * Environment variables:
 * - REVENUECAT_WEBHOOK_AUTH: Authorization header value for webhook security.
 *   REQUIRED in production — fail-fast at boot if missing so mobile IAP
 *   events cannot be silently dropped.
 *
 * @see https://www.revenuecat.com/docs/integrations/webhooks
 */

import { Elysia } from 'elysia';
import { logger } from '../lib/observability';
import { env } from '../config/env.js';

// ============================================
// Configuration
// ============================================

// Webhook is enabled if REVENUECAT_WEBHOOK_AUTH is provided and validated.
// Boot validation in env.ts ensures the secret is ≥32 chars if present and required in prod.
const WEBHOOK_AUTH = env.REVENUECAT_WEBHOOK_AUTH ?? '';
const isWebhookEnabled = !!WEBHOOK_AUTH;

if (!isWebhookEnabled) {
  // Non-production only — explicit WARN so the dev dashboard surface is not
  // confused with a silent info-level skip.
  logger.warn('RevenueCat webhooks disabled — REVENUECAT_WEBHOOK_AUTH not configured (dev only)', {
    operation: 'revenuecat:webhook:skip',
    severity: 'medium' as const,
  });
}

// ============================================
// Conditional Export
// ============================================

/**
 * RevenueCat Webhook Routes
 * Returns empty plugin if RevenueCat is not configured (dev/test only — prod
 * is enforced by the boot-time throw above).
 */
export const revenuecatWebhookRoutes = isWebhookEnabled
  ? (await import('./revenuecat-webhook.handler.js')).createRevenueCatWebhookRoutes()
  : new Elysia({ prefix: '/webhooks/revenuecat' });
