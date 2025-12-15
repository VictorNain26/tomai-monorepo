/**
 * Subscription Prorata - Preview et réactivation
 */

import { getApiUrl } from './config';

const API_URL = getApiUrl();

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
  parentId: string,
  childId?: string
): Promise<ICancelPendingRemovalResponse> {
  const response = await fetch(
    `${API_URL}/api/subscriptions/cancel-pending-removal`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parentId, childId }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error ?? 'Échec de la réactivation');
  }

  return response.json() as Promise<ICancelPendingRemovalResponse>;
}
