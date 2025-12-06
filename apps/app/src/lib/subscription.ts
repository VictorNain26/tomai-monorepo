/**
 * Subscription Service - Stripe Integration
 *
 * API client for family-based subscription management
 * Per-child pricing model:
 * - First child: 15€/month
 * - Additional children: +5€/month each
 *
 * Only parents can manage subscriptions.
 */

import type {
  SubscriptionPlanType,
  ISubscriptionPlan,
  ISubscriptionStatus,
  ICheckoutResponse,
  IPortalResponse,
  ICancelSubscriptionResponse,
  IManageChildrenResponse,
  IResumeSubscriptionResponse,
  IPricingInfo,
  IUsageResponse,
} from '@/types';

// ============================================
// API Configuration
// ============================================

const getApiUrl = (): string => {
  if (import.meta.env['VITE_API_URL']) {
    return import.meta.env['VITE_API_URL'];
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}`;
};

const API_URL = getApiUrl();

// ============================================
// Pricing Configuration
// ============================================

/** Price for first child in cents */
export const FIRST_CHILD_PRICE_CENTS = 1500;

/** Price for additional children in cents */
export const ADDITIONAL_CHILD_PRICE_CENTS = 500;

/** Daily token limit for free plan */
export const FREE_DAILY_TOKENS = 5000;

/** Daily token limit for premium plan */
export const PREMIUM_DAILY_TOKENS = 50000;

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
      '5 000 tokens/jour',
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
      '50 000 tokens/jour par enfant',
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

// ============================================
// API Functions
// ============================================

/**
 * Create Stripe Checkout session for premium subscription
 *
 * @param parentId - Parent user ID
 * @param childrenIds - Array of children IDs to upgrade (optional, defaults to all children)
 */
export async function createCheckoutSession(
  parentId: string,
  childrenIds?: string[]
): Promise<ICheckoutResponse> {
  const response = await fetch(`${API_URL}/api/subscriptions/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ parentId, childrenIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    // Handle specific error codes
    if (error.code === 'EXISTING_SUBSCRIPTION') {
      throw new Error('Vous avez déjà un abonnement actif. Utilisez "Ajouter des enfants" pour mettre à niveau.');
    }
    if (error.code === 'SUBSCRIPTION_CANCELED_PENDING') {
      throw new Error('Votre abonnement est en cours d\'annulation. Utilisez "Ajouter des enfants" pour réactiver et ajouter de nouveaux enfants.');
    }
    throw new Error(error.error ?? 'Échec de la création de la session de paiement');
  }

  return response.json() as Promise<ICheckoutResponse>;
}

/**
 * Add children to existing subscription (with proration)
 *
 * @param parentId - Parent user ID
 * @param childrenIds - Array of children IDs to add
 */
export async function addChildrenToSubscription(
  parentId: string,
  childrenIds: string[]
): Promise<IManageChildrenResponse> {
  const response = await fetch(`${API_URL}/api/subscriptions/add-children`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ parentId, childrenIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec de l\'ajout des enfants');
  }

  return response.json() as Promise<IManageChildrenResponse>;
}

/**
 * Remove children from subscription (no refund, changes at period end)
 *
 * @param parentId - Parent user ID
 * @param childrenIds - Array of children IDs to remove
 */
export async function removeChildrenFromSubscription(
  parentId: string,
  childrenIds: string[]
): Promise<IManageChildrenResponse> {
  const response = await fetch(`${API_URL}/api/subscriptions/remove-children`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ parentId, childrenIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec de la suppression des enfants');
  }

  return response.json() as Promise<IManageChildrenResponse>;
}

/**
 * Get Stripe Customer Portal URL
 */
export async function getPortalSession(parentId: string): Promise<IPortalResponse> {
  const response = await fetch(
    `${API_URL}/api/subscriptions/portal?parentId=${encodeURIComponent(parentId)}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec de l\'accès au portail client');
  }

  return response.json() as Promise<IPortalResponse>;
}

/**
 * Get current subscription status
 */
export async function getSubscriptionStatus(parentId: string): Promise<ISubscriptionStatus> {
  const response = await fetch(
    `${API_URL}/api/subscriptions/status?parentId=${encodeURIComponent(parentId)}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec de la récupération du statut');
  }

  return response.json() as Promise<ISubscriptionStatus>;
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(parentId: string): Promise<ICancelSubscriptionResponse> {
  const response = await fetch(`${API_URL}/api/subscriptions/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ parentId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec de l\'annulation de l\'abonnement');
  }

  return response.json() as Promise<ICancelSubscriptionResponse>;
}

/**
 * Resume a canceled subscription (before period end)
 */
export async function resumeSubscription(parentId: string): Promise<IResumeSubscriptionResponse> {
  const response = await fetch(`${API_URL}/api/subscriptions/resume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ parentId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec de la réactivation de l\'abonnement');
  }

  return response.json() as Promise<IResumeSubscriptionResponse>;
}

/**
 * Get token usage for a user (child)
 * Both children and parents can call this endpoint
 */
export async function getTokenUsage(userId: string): Promise<IUsageResponse> {
  const response = await fetch(
    `${API_URL}/api/subscriptions/usage?userId=${encodeURIComponent(userId)}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec de la récupération de l\'utilisation');
  }

  return response.json() as Promise<IUsageResponse>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Redirect to Stripe Checkout
 */
export async function redirectToCheckout(parentId: string, childrenIds?: string[]): Promise<void> {
  const { url } = await createCheckoutSession(parentId, childrenIds);
  if (url) {
    window.location.href = url;
  } else {
    throw new Error('URL de checkout non disponible');
  }
}

/**
 * Redirect to Customer Portal
 */
export async function redirectToPortal(parentId: string): Promise<void> {
  const { url } = await getPortalSession(parentId);
  if (url) {
    window.location.href = url;
  } else {
    throw new Error('URL du portail non disponible');
  }
}

/**
 * Format price for display (French locale)
 */
export function formatPrice(priceInCents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceInCents / 100);
}

/**
 * Format price in euros for display (French locale)
 */
export function formatPriceEuros(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

/**
 * Format date for subscription period end
 */
export function formatPeriodEnd(dateString: string | null): string {
  if (!dateString) return 'Non défini';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateString));
}

/**
 * Get plan display name from key
 */
export function getPlanDisplayName(plan: SubscriptionPlanType): string {
  const planConfig = SUBSCRIPTION_PLANS[plan.toUpperCase() as Uppercase<SubscriptionPlanType>];
  return planConfig?.name ?? 'Gratuit';
}

/**
 * Calculate monthly price for given number of children
 */
export function calculateMonthlyPrice(childrenCount: number): number {
  return PRICING_INFO.calculateTotal(childrenCount);
}

/**
 * Check if user has active premium subscription
 */
export function isPremiumActive(status: ISubscriptionStatus): boolean {
  return status.plan === 'premium' && status.status === 'active';
}

/**
 * Check if subscription is canceled but still active until period end
 * This happens when cancel_at_period_end is true in Stripe
 * The billing status in DB may still be 'active' until period end
 */
export function isCanceledButActive(status: ISubscriptionStatus): boolean {
  return (
    status.plan === 'premium' &&
    status.subscription?.cancelAtPeriodEnd === true
  );
}

/**
 * Check if there are pending removal changes
 */
export function hasPendingChanges(status: ISubscriptionStatus): boolean {
  return status.subscription?.hasScheduledChanges === true;
}

/**
 * Get children IDs that are pending removal
 */
export function getPendingRemovalChildrenIds(status: ISubscriptionStatus): string[] {
  return status.subscription?.pendingRemovalChildrenIds ?? [];
}

// ============================================
// Prorata Preview Types and Functions
// ============================================

/**
 * Response from the preview-add-children endpoint
 */
export interface IAddChildrenPreview {
  childrenCount: number;
  prorata: {
    amountCents: number;
    amount: string;
    daysRemaining: number;
    totalDaysInPeriod: number;
    currentPeriodEnd: string;
  };
  newSubscription: {
    monthlyAmountCents: number;
    monthlyAmount: string;
  };
  pricePerChildCents: number;
  pricePerChild: string;
}

/**
 * Preview prorata amount for adding children
 *
 * Call this before showing the add-children confirmation modal
 * to display the exact amount that will be charged.
 *
 * @param parentId - Parent user ID
 * @param childrenCount - Number of children to add
 */
export async function previewAddChildren(
  parentId: string,
  childrenCount: number
): Promise<IAddChildrenPreview> {
  const params = new URLSearchParams({
    parentId,
    childrenCount: childrenCount.toString(),
  });

  const response = await fetch(
    `${API_URL}/api/subscriptions/preview-add-children?${params.toString()}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec du calcul du prorata');
  }

  return response.json() as Promise<IAddChildrenPreview>;
}

// ============================================
// Reactivation (Cancel Pending Removal)
// ============================================

/**
 * Response from the cancel-pending-removal endpoint
 */
export interface ICancelPendingRemovalResponse {
  success: boolean;
  message: string;
  subscription: {
    status: string;
    premiumChildrenCount: number;
    monthlyAmountCents: number;
    currentPeriodEnd: string;
    hasScheduledChanges: boolean;
    pendingRemovalChildrenIds: string[];
  };
}

/**
 * Cancel pending removal of children (reactivate them)
 *
 * This cancels any scheduled removal and keeps all children on Premium.
 * No additional charge is applied because they were already paid for.
 *
 * @param parentId - Parent user ID
 */
export async function cancelPendingRemoval(
  parentId: string
): Promise<ICancelPendingRemovalResponse> {
  const response = await fetch(
    `${API_URL}/api/subscriptions/cancel-pending-removal`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parentId }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec de la réactivation');
  }

  return response.json() as Promise<ICancelPendingRemovalResponse>;
}
