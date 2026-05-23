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

// ============================================
// Configuration
// ============================================

// Bun's `bun build --target bun` replaces `process.env.NODE_ENV` literals at
// build time (the bundled dist/index.js freezes the value from when the image
// was built, where NODE_ENV is not yet "production"). Reading through Bun.env
// bypasses the replacement and gives the true runtime value.
const WEBHOOK_AUTH = Bun.env['REVENUECAT_WEBHOOK_AUTH'] ?? '';
const isWebhookEnabled = !!WEBHOOK_AUTH;
const isProduction = Bun.env['NODE_ENV'] === 'production';

// Fail-fast in production — a missing REVENUECAT_WEBHOOK_AUTH in prod means
// every IAP event (INITIAL_PURCHASE, RENEWAL, CANCELLATION, …) would 404 and
// the family_billing row never gets populated, silently breaking mobile
// subscriptions. The handler file also guards against a short/missing secret,
// but that check was previously unreachable because of the conditional import
// below — this boot-time throw closes the loop.
if (isProduction && !isWebhookEnabled) {
  throw new Error(
    'REVENUECAT_WEBHOOK_AUTH must be set in production. ' +
    'RevenueCat webhooks cannot be silently disabled or iOS/Android ' +
    'subscriptions will not synchronize with the backend. ' +
    'Generate with `openssl rand -base64 48` and configure the ' +
    'RevenueCat dashboard to send it in the Authorization header.',
  );
}

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
