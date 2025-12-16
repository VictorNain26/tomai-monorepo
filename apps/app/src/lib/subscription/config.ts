/**
 * Subscription Configuration - Plans et pricing
 */

import type {
  SubscriptionPlanType,
  ISubscriptionPlan,
  IPricingInfo,
} from '@/types';
import { getBackendURL } from '@/utils/urls';

// ============================================
// API Configuration
// ============================================

/** @deprecated Use getBackendURL from @/utils/urls directly */
export const getApiUrl = getBackendURL;

// ============================================
// Pricing Configuration
// ============================================

/** Price for first child in cents */
export const FIRST_CHILD_PRICE_CENTS = 1500;

/** Price for additional children in cents */
export const ADDITIONAL_CHILD_PRICE_CENTS = 500;

/** Daily token limit for free plan */
export const FREE_DAILY_TOKENS = 5000;

/**
 * Pricing info for UI display
 */
export const PRICING_INFO: IPricingInfo = {
  firstChildPrice: 15, // 15€
  additionalChildPrice: 5, // 5€
  calculateTotal: (childrenCount: number): number => {
    if (childrenCount <= 0) return 0;
    return 15 + Math.max(0, childrenCount - 1) * 5;
  },
};

// ============================================
// Subscription Plans Configuration
// ============================================

export const SUBSCRIPTION_PLANS: Record<Uppercase<SubscriptionPlanType>, ISubscriptionPlan> = {
  FREE: {
    key: 'free',
    name: 'Gratuit',
    description: 'Découvrez TomIA gratuitement',
    priceFirstChildCents: 0,
    priceAdditionalChildCents: 0,
    features: [
      '5 000 tokens par session',
      'Toutes les matières',
      'IA Gemini Flash',
      'Support communauté',
    ],
  },
  PREMIUM: {
    key: 'premium',
    name: 'Premium',
    description: 'L\'expérience complète pour toute la famille',
    priceFirstChildCents: FIRST_CHILD_PRICE_CENTS,
    priceAdditionalChildCents: ADDITIONAL_CHILD_PRICE_CENTS,
    features: [
      '25 000 tokens par session (5h)',
      '75 000 tokens/jour par enfant',
      'Toutes les matières',
      'IA Gemini Flash',
      'Support prioritaire',
      'Historique illimité',
      'Suivi parental avancé',
    ],
    highlighted: true,
    badge: 'Recommandé',
  },
};
