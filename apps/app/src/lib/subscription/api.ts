/**
 * Subscription API - Stripe endpoints
 */

import type {
  ISubscriptionStatus,
  ICheckoutResponse,
  IPortalResponse,
  ICancelSubscriptionResponse,
  IManageChildrenResponse,
  IResumeSubscriptionResponse,
  IUsageResponse,
} from '@/types';
import { getApiUrl } from './config';

const API_URL = getApiUrl();

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
