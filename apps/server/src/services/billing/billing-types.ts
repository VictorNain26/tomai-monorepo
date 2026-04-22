/**
 * Billing service input types — shared between Stripe and RevenueCat flows.
 */

export interface BillingPeriod {
  start: Date;
  end: Date;
}

export type BillingSource =
  | { provider: 'stripe'; customerId: string; subscriptionId: string }
  | { provider: 'revenuecat'; customerId: string; productId: string };

export interface ActivatePremiumInput {
  parentId: string;
  childrenIds: string[];
  period: BillingPeriod;
  monthlyAmountCents?: number;
  premiumChildrenCount?: number;
  source: BillingSource;
}

export interface ExtendActivePeriodInput {
  parentId: string;
  childrenIds: string[];
  period: BillingPeriod;
  /**
   * When true, children's token counters are reset (fresh billing period).
   * Leave false for intermediate activity updates that don't cross a boundary.
   */
  resetChildCounters: boolean;
}
