/**
 * Stripe Subscription Service
 *
 * Façade class that delegates to specialized modules.
 * See individual modules for implementation details:
 * - billing.ts: Database operations
 * - customer.ts: Stripe customer management
 * - checkout.ts: Checkout session creation
 * - children.ts: Add/remove children from subscription
 * - lifecycle.ts: Cancel, resume, pending changes
 * - status.ts: Status, portal, prorata calculations
 *
 * Pricing Model:
 * - First child: 15€/month
 * - Additional children: +5€/month each (with proration)
 *
 * Billing Rules:
 * - ADD: Immediate proration (charge remaining days)
 * - REMOVE: No refund, change at period end
 * - CANCEL: At end of paid period
 * - RESUME: Possible before period end without repaying
 */

import type Stripe from 'stripe';
import { getPremiumPlanConfig, getFreePlanId, getPremiumPlanId } from './config';
import { NoPlanConfiguredError } from './errors';
import type {
  PremiumPlanConfig,
  CheckoutResult,
  SubscriptionInfo,
  ProrataCalculation,
} from './types';
import { calculateMonthlyPrice } from './helpers';

// Import module functions
import { createCustomer, getOrCreateCustomer } from './customer';
import { createCheckoutSession } from './checkout';
import { addChildrenToSubscription, removeChildrenFromSubscription } from './children';
import {
  cancelSubscription,
  cancelPendingRemoval,
  resumeSubscription,
} from './lifecycle';
import {
  createPortalSession,
  getSubscriptionStatus,
  calculateAddChildrenProrata,
  constructWebhookEventAsync,
} from './status';

export class StripeSubscriptionService {
  // ============================================
  // Plan Configuration
  // ============================================

  async getPremiumPlanConfig(): Promise<PremiumPlanConfig | null> {
    return getPremiumPlanConfig();
  }

  async getFreePlanId(): Promise<string | null> {
    return getFreePlanId();
  }

  async getPremiumPlanId(): Promise<string | null> {
    return getPremiumPlanId();
  }

  private async requirePlanConfig(): Promise<PremiumPlanConfig> {
    const planConfig = await this.getPremiumPlanConfig();
    if (!planConfig) throw new NoPlanConfiguredError();
    return planConfig;
  }

  // ============================================
  // Price Calculation
  // ============================================

  calculateMonthlyPrice(childrenCount: number, planConfig: PremiumPlanConfig): number {
    return calculateMonthlyPrice(childrenCount, planConfig);
  }

  // ============================================
  // Customer Management
  // ============================================

  async createCustomer(params: {
    email: string;
    name?: string;
    metadata: Record<string, string>;
  }): Promise<Stripe.Customer> {
    return createCustomer(params);
  }

  async getOrCreateCustomer(parentId: string): Promise<{ customerId: string; isNew: boolean }> {
    return getOrCreateCustomer(parentId);
  }

  // ============================================
  // Checkout Session
  // ============================================

  async createCheckoutSession(params: {
    parentId: string;
    childrenIds: string[];
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutResult> {
    return createCheckoutSession(params);
  }

  // ============================================
  // Children Management
  // ============================================

  async addChildrenToSubscription(
    parentId: string,
    newChildrenIds: string[]
  ): Promise<SubscriptionInfo> {
    return addChildrenToSubscription(parentId, newChildrenIds);
  }

  async removeChildrenFromSubscription(
    parentId: string,
    childrenIdsToRemove: string[]
  ): Promise<SubscriptionInfo> {
    return removeChildrenFromSubscription(parentId, childrenIdsToRemove);
  }

  // ============================================
  // Subscription Lifecycle
  // ============================================

  async cancelSubscription(parentId: string): Promise<SubscriptionInfo> {
    return cancelSubscription(parentId);
  }

  async cancelPendingRemoval(
    parentId: string,
    childId?: string
  ): Promise<SubscriptionInfo> {
    return cancelPendingRemoval(parentId, childId);
  }

  async resumeSubscription(parentId: string): Promise<SubscriptionInfo> {
    return resumeSubscription(parentId);
  }

  // ============================================
  // Portal & Status
  // ============================================

  async createPortalSession(params: {
    parentId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    return createPortalSession(params);
  }

  async getSubscriptionStatus(parentId: string): Promise<SubscriptionInfo | null> {
    return getSubscriptionStatus(parentId);
  }

  // ============================================
  // Prorata Calculation
  // ============================================

  async calculateAddChildrenProrata(
    parentId: string,
    newChildrenCount: number
  ): Promise<ProrataCalculation> {
    return calculateAddChildrenProrata(parentId, newChildrenCount);
  }

  // ============================================
  // Webhook
  // ============================================

  async constructWebhookEventAsync(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Promise<Stripe.Event> {
    return constructWebhookEventAsync(payload, signature, webhookSecret);
  }
}
