/**
 * Subscription Helpers - Formatters et utilitaires
 */

import type { SubscriptionPlanType, ISubscriptionStatus } from '@/types';
import { SUBSCRIPTION_PLANS } from './config';
import { createCheckoutSession, getPortalSession } from './api';

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
 * Open Customer Portal in new tab
 */
export async function redirectToPortal(parentId: string): Promise<void> {
  const { url } = await getPortalSession(parentId);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    throw new Error('URL du portail non disponible');
  }
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
