import { Elysia } from 'elysia';
import Stripe from 'stripe';
import { stripeService } from '../lib/stripe';
import { logger } from '../lib/observability';
import { isStripeEventProcessed, markStripeEventProcessed } from '../services/webhook-idempotence.service';
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleScheduleUpdated,
} from './stripe-webhook-handlers';

const MAX_WEBHOOK_BODY_SIZE = 256 * 1024;

async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  return isStripeEventProcessed(eventId);
}

async function markEventAsProcessed(eventId: string, eventType: string): Promise<void> {
  await markStripeEventProcessed(eventId, eventType);
}

export function createWebhookRoutes(webhookSecret: string) {
  return new Elysia({ prefix: '/webhooks/stripe' }).post(
    '/',
    async ({ request, set }) => {
      const contentLength = request.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > MAX_WEBHOOK_BODY_SIZE) {
          logger.warn('[Stripe Webhook] Request too large', {
            operation: 'stripe:webhook:size-limit',
            contentLength: size,
            maxAllowed: MAX_WEBHOOK_BODY_SIZE,
            severity: 'medium' as const,
          });
          set.status = 413;
          return { error: 'Request entity too large' };
        }
      }

      const rawBody = await request.text();

      if (rawBody.length > MAX_WEBHOOK_BODY_SIZE) {
        logger.warn('[Stripe Webhook] Body too large after read', {
          operation: 'stripe:webhook:size-limit',
          bodyLength: rawBody.length,
          maxAllowed: MAX_WEBHOOK_BODY_SIZE,
          severity: 'medium' as const,
        });
        set.status = 413;
        return { error: 'Request entity too large' };
      }

      const signature = request.headers.get('stripe-signature');

      if (!signature) {
        set.status = 400;
        return { error: 'Missing stripe-signature header' };
      }

      let event: Stripe.Event;

      try {
        event = await stripeService.constructWebhookEventAsync(rawBody, signature, webhookSecret);
      } catch (error) {
        logger.error('[Stripe Webhook] Signature verification failed', {
          operation: 'stripe:webhook:verify',
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        set.status = 400;
        return { error: 'Invalid signature' };
      }

      if (await isEventAlreadyProcessed(event.id)) {
        logger.info(`[Stripe Webhook] Duplicate event skipped: ${event.id}`, {
          operation: 'stripe:webhook:duplicate',
          eventId: event.id,
          eventType: event.type,
        });
        return { received: true, duplicate: true };
      }

      logger.info(`[Stripe Webhook] Received: ${event.type}`, {
        operation: 'stripe:webhook:receive',
        eventId: event.id,
        eventType: event.type,
      });

      try {
        switch (event.type) {
          case 'checkout.session.completed':
            await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
            break;
          case 'invoice.paid':
            await handleInvoicePaid(event.data.object as Stripe.Invoice);
            break;
          case 'invoice.payment_failed':
            await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
            break;
          case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
            break;
          case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
            break;
          case 'subscription_schedule.updated':
            await handleScheduleUpdated(event.data.object as Stripe.SubscriptionSchedule);
            break;
          default:
            logger.debug(`[Stripe Webhook] Unhandled event: ${event.type}`, {
              operation: 'stripe:webhook:unhandled',
              eventType: event.type,
            });
        }

        await markEventAsProcessed(event.id, event.type);

        return { received: true, event: event.type };
      } catch (error) {
        logger.error(`[Stripe Webhook] Error processing ${event.type}`, {
          operation: 'stripe:webhook:process',
          eventType: event.type,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        set.status = 500;
        return { error: 'Webhook processing failed' };
      }
    },
    { parse: 'none' }
  );
}
