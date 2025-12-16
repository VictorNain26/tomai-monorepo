/**
 * Subscription Module - Barrel exports
 *
 * API client for family-based subscription management
 * Per-child pricing model:
 * - First child: 15€/month
 * - Additional children: +5€/month each
 *
 * Only parents can manage subscriptions.
 */

// Config
export {
  getApiUrl,
  FIRST_CHILD_PRICE_CENTS,
  ADDITIONAL_CHILD_PRICE_CENTS,
  FREE_DAILY_TOKENS,
  PRICING_INFO,
  SUBSCRIPTION_PLANS,
} from './config';

// API
export {
  createCheckoutSession,
  addChildrenToSubscription,
  removeChildrenFromSubscription,
  getPortalSession,
  getSubscriptionStatus,
  cancelSubscription,
  resumeSubscription,
  getTokenUsage,
} from './api';

// Helpers
export {
  redirectToCheckout,
  redirectToPortal,
  formatPriceEuros,
  formatPeriodEnd,
  getPlanDisplayName,
  isPremiumActive,
  isCanceledButActive,
  hasPendingChanges,
} from './helpers';

// Prorata
export type { IAddChildrenPreview, ICancelPendingRemovalResponse } from './prorata';
export { previewAddChildren, cancelPendingRemoval } from './prorata';
