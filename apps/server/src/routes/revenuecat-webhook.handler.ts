import { Elysia } from 'elysia';
import { logger } from '../lib/observability';
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
  type RevenueCatEvent,
} from './revenuecat-webhook-events';

const WEBHOOK_AUTH_HEADER = process.env.REVENUECAT_WEBHOOK_AUTH;

export function createRevenueCatWebhookRoutes() {
  return new Elysia({ prefix: '/webhooks/revenuecat' }).post(
    '/',
    async ({ request, body, set }) => {
      if (WEBHOOK_AUTH_HEADER) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== WEBHOOK_AUTH_HEADER) {
          logger.warn('[RevenueCat Webhook] Invalid authorization', {
            operation: 'revenuecat:webhook:auth',
            severity: 'high' as const,
          });
          set.status = 401;
          return { error: 'Unauthorized' };
        }
      }

      const payload = body as RevenueCatEvent;
      const event = payload.event;

      if (process.env.NODE_ENV === 'production' && event.environment === 'SANDBOX') {
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
