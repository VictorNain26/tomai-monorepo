/**
 * Subscription Types - Stripe et facturation
 */

import type { EducationSubject } from './education.types';

// ======================================
// Subscription & Stripe Types
// ======================================

/**
 * Plan types: free or premium (per-child pricing)
 * Old student/family plans are deprecated
 */
export type SubscriptionPlanType = 'free' | 'premium';

/**
 * Billing status matching backend familyBilling.billingStatus
 */
export type BillingStatusType = 'active' | 'inactive' | 'past_due' | 'canceled' | 'expired';

/**
 * Subscription plan display info
 */
export interface ISubscriptionPlan {
  key: SubscriptionPlanType;
  name: string;
  description: string;
  /** Price for first child in cents (e.g., 1500 = 15€) */
  priceFirstChildCents: number;
  /** Price for additional children in cents (e.g., 500 = 5€) */
  priceAdditionalChildCents: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

/**
 * Per-child pricing info for display
 */
export interface IPricingInfo {
  firstChildPrice: number; // In euros (15)
  additionalChildPrice: number; // In euros (5)
  calculateTotal: (childrenCount: number) => number;
}

/**
 * Child subscription status for parent dashboard
 */
export interface IChildSubscriptionStatus {
  childId: string;
  childName: string;
  plan: SubscriptionPlanType;
  status: 'active' | 'paused' | 'pending_removal';
  /** If pending_removal, when will it be downgraded */
  removalDate?: string;
}

/**
 * Family subscription status - returned by /api/subscriptions/status
 */
export interface ISubscriptionStatus {
  /** Current plan type */
  plan: SubscriptionPlanType;
  /** Billing status */
  status: BillingStatusType;
  /** Billing details (only for premium) */
  billing: {
    premiumChildrenCount: number;
    monthlyAmountCents: number;
    monthlyAmount: string; // Formatted (e.g., "15.00€")
    billingStatus: BillingStatusType;
  } | null;
  /** Stripe subscription details (only for premium) */
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    /** Children IDs pending removal at period end */
    pendingRemovalChildrenIds?: string[];
    /** New children count after pending changes */
    scheduledChildrenCount?: number;
    /** New monthly amount after pending changes */
    scheduledMonthlyAmountCents?: number;
    /** Has scheduled changes (pending removals) */
    hasScheduledChanges?: boolean;
  } | null;
  /** Children with their subscription status */
  children: Array<{
    id: string;
    name: string;
    username: string;
    plan: string;
    status: string;
  }>;
}

/**
 * Checkout session response
 */
export interface ICheckoutResponse {
  sessionId: string;
  url: string;
  childrenCount: number;
}

/**
 * Portal session response
 */
export interface IPortalResponse {
  url: string;
}

/**
 * Cancel subscription response
 */
export interface ICancelSubscriptionResponse {
  success: boolean;
  message: string;
  subscription: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
  };
}

/**
 * Add/remove children response
 */
export interface IManageChildrenResponse {
  plan: SubscriptionPlanType;
  status: BillingStatusType;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    premiumChildrenCount: number;
    monthlyAmountCents: number;
    monthlyAmount: string;
    /** For removal: pending changes info */
    pendingRemovalChildrenIds?: string[];
    scheduledChildrenCount?: number;
    scheduledMonthlyAmountCents?: number;
    hasScheduledChanges?: boolean;
  } | null;
}

/**
 * Resume subscription response
 */
export interface IResumeSubscriptionResponse {
  success: boolean;
  message: string;
  subscription: IManageChildrenResponse;
}

// ======================================
// Token Usage Types
// ======================================

/**
 * Token usage info for a user (legacy format for backward compatibility)
 */
export interface ITokenUsage {
  tokensUsed: number;
  tokensRemaining: number;
  dailyLimit: number;
  usagePercentage: number;
  lastResetAt: string;
  resetsIn: string;
}

/**
 * Rolling window usage (primary display - 5h window)
 * Inspired by ChatGPT/Claude architecture 2025
 */
export interface IWindowUsage {
  tokensUsed: number;
  tokensRemaining: number;
  limit: number;
  usagePercent: number;
  /** Format: "Xh Ymin" until next token refresh */
  refreshIn: string;
}

/**
 * Daily cap usage (secondary - anti-abuse measure)
 */
export interface IDailyUsage {
  tokensUsed: number;
  tokensRemaining: number;
  limit: number;
  usagePercent: number;
  /** Format: "Xh Ymin" until 10h Paris reset */
  resetsIn: string;
}

/**
 * Weekly stats (for parent dashboard)
 */
export interface IWeeklyUsage {
  tokensUsed: number;
}

/**
 * Lifetime stats
 */
export interface ILifetimeUsage {
  totalTokensUsed: number;
  totalMessagesCount: number;
}

/**
 * Usage response from API (new rolling window format 2025)
 */
export interface IUsageResponse {
  userId: string;
  plan: 'free' | 'premium';
  /** Rolling window 5h - primary display */
  window: IWindowUsage;
  /** Daily cap (reset 10h Paris) - secondary */
  daily: IDailyUsage;
  /** Weekly stats for parent dashboard */
  weekly: IWeeklyUsage;
  /** Lifetime stats */
  lifetime: ILifetimeUsage;
  /** Legacy format for backward compatibility */
  usage: ITokenUsage;
}

// ======================================
// Smart Subjects System Types
// ======================================

export interface ISubjectsForStudent {
  subjects: EducationSubject[];
}

export interface ISubjectsResponse {
  success: boolean;
  data: ISubjectsForStudent;
  message: string;
}
