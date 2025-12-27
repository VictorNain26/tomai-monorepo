/**
 * Stripe Checkout Session
 *
 * Handles creation of Stripe checkout sessions for subscriptions.
 */

import type Stripe from 'stripe';
import { requireStripe, getPremiumPlanConfig } from './config';
import {
  StripeServiceError,
  NoPlanConfiguredError,
  ExistingSubscriptionError,
  SubscriptionCanceledPendingError,
} from './errors';
import type { PremiumPlanConfig, CheckoutResult } from './types';
import { getBilling, clearBillingSubscription } from './billing';
import { getOrCreateCustomer } from './customer';

/**
 * Build line items for checkout session
 */
function buildCheckoutLineItems(
  childrenCount: number,
  planConfig: PremiumPlanConfig
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: planConfig.priceIdFirstChild, quantity: 1 },
  ];

  if (childrenCount > 1) {
    items.push({ price: planConfig.priceIdAdditionalChild, quantity: childrenCount - 1 });
  }

  return items;
}

/**
 * Validate that there is no active subscription before creating checkout
 */
async function validateNoActiveSubscription(
  subscriptionId: string,
  parentId: string
): Promise<void> {
  try {
    const existingSub = await requireStripe().subscriptions.retrieve(subscriptionId);

    if (existingSub.status === 'canceled') {
      await clearBillingSubscription(parentId);
    } else if (!existingSub.cancel_at_period_end) {
      throw new ExistingSubscriptionError();
    } else {
      throw new SubscriptionCanceledPendingError();
    }
  } catch (error) {
    if (error instanceof StripeServiceError) throw error;
    await clearBillingSubscription(parentId);
  }
}

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(params: {
  parentId: string;
  childrenIds: string[];
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutResult> {
  const { parentId, childrenIds, successUrl, cancelUrl } = params;

  if (childrenIds.length === 0) {
    throw new StripeServiceError('NO_CHILDREN', 'At least one child must be selected');
  }

  const planConfig = await getPremiumPlanConfig();
  if (!planConfig) throw new NoPlanConfiguredError();

  const { customerId } = await getOrCreateCustomer(parentId);

  const existingBilling = await getBilling(parentId);
  if (existingBilling?.stripeSubscriptionId) {
    await validateNoActiveSubscription(existingBilling.stripeSubscriptionId, parentId);
  }

  const lineItems = buildCheckoutLineItems(childrenIds.length, planConfig);
  const metadata = {
    parentId,
    childrenIds: JSON.stringify(childrenIds),
    childrenCount: childrenIds.length.toString(),
  };

  const session = await requireStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    metadata,
    subscription_data: { metadata },
  });

  return { sessionId: session.id, url: session.url };
}
