/**
 * Stripe Customer Management
 *
 * Handles Stripe customer creation and retrieval.
 */

import type Stripe from 'stripe';
import { db } from '../../db/connection';
import { user } from '../../db/schema';
import { eq } from 'drizzle-orm';

import { stripe } from './config';
import { ParentNotFoundError } from './errors';
import {
  getBilling,
  createBillingRecord,
  updateBillingCustomerId,
} from './billing';

/**
 * Create a new Stripe customer
 */
export async function createCustomer(params: {
  email: string;
  name?: string;
  metadata: Record<string, string>;
}): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata,
  });
}

/**
 * Get or create a Stripe customer for a parent
 * Returns existing customer ID if found, otherwise creates new customer
 */
export async function getOrCreateCustomer(
  parentId: string
): Promise<{ customerId: string; isNew: boolean }> {
  const billing = await getBilling(parentId);

  if (billing?.stripeCustomerId) {
    return { customerId: billing.stripeCustomerId, isNew: false };
  }

  const [parent] = await db
    .select()
    .from(user)
    .where(eq(user.id, parentId))
    .limit(1);

  if (!parent) {
    throw new ParentNotFoundError();
  }

  const customer = await createCustomer({
    email: parent.email ?? `${parent.username}@tomia.local`,
    name: parent.name ?? parent.username ?? undefined,
    metadata: {
      parentId: parent.id,
      type: 'parent',
    },
  });

  if (billing) {
    await updateBillingCustomerId(parentId, customer.id);
  } else {
    await createBillingRecord(parentId, customer.id);
  }

  return { customerId: customer.id, isNew: true };
}
