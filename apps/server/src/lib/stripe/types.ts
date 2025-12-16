/**
 * Stripe Service Types
 * Interfaces and type definitions for subscription operations
 */

import type { familyBilling } from '../../db/schema';

/** Period info extracted from Stripe subscription item */
export interface SubscriptionPeriod {
  start: number;
  end: number;
}

export interface PremiumPlanConfig {
  productId: string;
  priceIdFirstChild: string;
  priceIdAdditionalChild: string;
  priceFirstChildCents: number;
  priceAdditionalChildCents: number;
}

export interface CheckoutResult {
  sessionId: string;
  url: string | null;
}

export interface SubscriptionInfo {
  subscriptionId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  premiumChildrenCount: number;
  monthlyAmountCents: number;
  cancelAtPeriodEnd: boolean;
  /** Children pending removal at period end (still active until then) */
  pendingRemovalChildrenIds?: string[];
  /** New children count after pending changes apply */
  scheduledChildrenCount?: number;
  /** New monthly amount after pending changes apply */
  scheduledMonthlyAmountCents?: number;
  /** Has a schedule with pending changes */
  hasScheduledChanges?: boolean;
}

export interface ProrataCalculation {
  prorataAmountCents: number;
  prorataAmount: string;
  daysRemaining: number;
  totalDaysInPeriod: number;
  currentPeriodEnd: Date;
  newMonthlyAmountCents: number;
  newMonthlyAmount: string;
  pricePerChildCents: number;
}

/** Type for family_billing record */
export type FamilyBillingRecord = typeof familyBilling.$inferSelect;
