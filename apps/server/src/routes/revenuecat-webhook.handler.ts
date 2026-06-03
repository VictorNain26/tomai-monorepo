import { Elysia } from 'elysia';
import { timingSafeEqual } from 'node:crypto';
import { logger } from '../lib/observability';
import { env, isProduction } from '../config/env.js';
import {
  isRevenueCatEventProcessed,
  markRevenueCatEventProcessed,
} from '../services/webhook-idempotence.service';
import {
  handleInitialPurchase,
  handleRenewal,
  handleCancellation,
  handleExpiration,
  handleBillingIssue,
  handleUncancellation,
} from './revenuecat-webhook-events';
import { revenueCatWebhookSchema } from '../schemas/validation';

// Webhook auth secret (validated at boot in env.ts, prod: ≥32 chars minimum)
// Validation of presence + length already checked in env.ts prodChecks.
const WEBHOOK_AUTH_HEADER = env.REVENUECAT_WEBHOOK_AUTH;

/**
 * Constant-time comparison of the Authorization header vs the configured secret.
 * Returns false for any length mismatch without leaking the comparison time.
 */
function authHeaderIsValid(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export function createRevenueCatWebhookRoutes() {
  return new Elysia({ prefix: '/webhooks/revenuecat' }).post(
    '/',
    async ({ request, body, set }) => {
      if (WEBHOOK_AUTH_HEADER) {
        const authHeader = request.headers.get('authorization');
        if (!authHeaderIsValid(authHeader, WEBHOOK_AUTH_HEADER)) {
          logger.warn('[RevenueCat Webhook] Invalid authorization', {
            operation: 'revenuecat:webhook:auth',
            severity: 'high' as const,
          });
          set.status = 401;
          return { error: 'Unauthorized' };
        }
      }

      const parsed = revenueCatWebhookSchema.safeParse(body);
      if (!parsed.success) {
        logger.warn('[RevenueCat Webhook] Malformed payload rejected', {
          operation: 'revenuecat:webhook:invalid_payload',
          _error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          severity: 'medium' as const,
        });
        set.status = 400;
        return { error: 'Invalid payload' };
      }
      const event = parsed.data.event;

      if (isProduction() && event.environment === 'SANDBOX') {
        return { received: true, skipped: 'sandbox' };
      }

      if (await isRevenueCatEventProcessed(event.id)) {
        logger.info(`[RevenueCat Webhook] Duplicate event skipped: ${event.id}`, {
          operation: 'revenuecat:webhook:duplicate',
          eventId: event.id,
        });
        return { received: true, duplicate: true };
      }

      logger.info(`[RevenueCat Webhook] Received: ${event.type}`, {
        operation: 'revenuecat:webhook:receive',
        eventId: event.id,
        eventType: event.type,
        appUserId: event.app_user_id,
      });

      try {
        switch (event.type) {
          case 'TEST':
            logger.info('[RevenueCat Webhook] Test event received');
            break;
          case 'INITIAL_PURCHASE':
          case 'NON_RENEWING_PURCHASE':
            await handleInitialPurchase(event);
            break;
          case 'RENEWAL':
            await handleRenewal(event);
            break;
          case 'CANCELLATION':
            await handleCancellation(event);
            break;
          case 'EXPIRATION':
            await handleExpiration(event);
            break;
          case 'BILLING_ISSUE':
            await handleBillingIssue(event);
            break;
          case 'UNCANCELLATION':
            await handleUncancellation(event);
            break;
          case 'PRODUCT_CHANGE':
            await handleRenewal(event);
            break;
          default:
            logger.debug(`[RevenueCat Webhook] Unhandled event: ${event.type}`, {
              operation: 'revenuecat:webhook:unhandled',
              eventType: event.type,
            });
        }

        await markRevenueCatEventProcessed(event.id, event.type);
        return { received: true, event: event.type };
      } catch (error) {
        logger.error(`[RevenueCat Webhook] Error processing ${event.type}`, {
          operation: 'revenuecat:webhook:process',
          eventType: event.type,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        set.status = 500;
        return { error: 'Webhook processing failed' };
      }
    }
  );
}
