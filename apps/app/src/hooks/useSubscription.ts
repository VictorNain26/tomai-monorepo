/**
 * useSubscription Hook - TanStack Query integration for subscriptions
 *
 * Provides reactive subscription state management for family-based billing
 * with per-child pricing model.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/lib/auth';
import {
  getSubscriptionStatus,
  createCheckoutSession,
  addChildrenToSubscription,
  removeChildrenFromSubscription,
  getPortalSession,
  cancelSubscription,
  resumeSubscription,
  redirectToCheckout,
  redirectToPortal,
  cancelPendingRemoval,
} from '@/lib/subscription';
import type { ISubscriptionStatus } from '@/types';

// Query keys
export const subscriptionKeys = {
  all: ['subscription'] as const,
  status: (parentId: string) => [...subscriptionKeys.all, 'status', parentId] as const,
};

/**
 * Hook for fetching subscription status
 * Only works for parent users
 */
export function useSubscriptionStatus() {
  const user = useUser();
  const parentId = user?.id;
  const isParent = user?.role === 'parent';

  return useQuery({
    queryKey: subscriptionKeys.status(parentId ?? ''),
    queryFn: () => {
      if (!parentId) throw new Error('Parent ID required');
      return getSubscriptionStatus(parentId);
    },
    enabled: !!parentId && isParent,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for creating checkout session
 */
export function useCreateCheckout() {
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: async (childrenIds?: string[]) => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      if (user.role !== 'parent') throw new Error('Seuls les parents peuvent gérer les abonnements');
      return createCheckoutSession(user.id, childrenIds);
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({
          queryKey: subscriptionKeys.status(user.id),
        });
      }
    },
  });
}

/**
 * Hook for redirecting to checkout
 */
export function useCheckoutRedirect() {
  const user = useUser();

  return useMutation({
    mutationFn: async (childrenIds?: string[]) => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      if (user.role !== 'parent') throw new Error('Seuls les parents peuvent gérer les abonnements');
      return redirectToCheckout(user.id, childrenIds);
    },
  });
}

/**
 * Hook for adding children to subscription
 */
export function useAddChildren() {
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: async (childrenIds: string[]) => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      if (user.role !== 'parent') throw new Error('Seuls les parents peuvent gérer les abonnements');
      return addChildrenToSubscription(user.id, childrenIds);
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({
          queryKey: subscriptionKeys.status(user.id),
        });
      }
    },
  });
}

/**
 * Hook for removing children from subscription
 */
export function useRemoveChildren() {
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: async (childrenIds: string[]) => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      if (user.role !== 'parent') throw new Error('Seuls les parents peuvent gérer les abonnements');
      return removeChildrenFromSubscription(user.id, childrenIds);
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({
          queryKey: subscriptionKeys.status(user.id),
        });
      }
    },
  });
}

/**
 * Hook for portal session
 */
export function usePortalSession() {
  const user = useUser();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      if (user.role !== 'parent') throw new Error('Seuls les parents peuvent accéder au portail');
      return getPortalSession(user.id);
    },
  });
}

/**
 * Hook for redirecting to customer portal
 */
export function usePortalRedirect() {
  const user = useUser();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      if (user.role !== 'parent') throw new Error('Seuls les parents peuvent accéder au portail');
      return redirectToPortal(user.id);
    },
  });
}

/**
 * Hook for canceling subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      if (user.role !== 'parent') throw new Error('Seuls les parents peuvent annuler l\'abonnement');
      return cancelSubscription(user.id);
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({
          queryKey: subscriptionKeys.status(user.id),
        });
      }
    },
  });
}

/**
 * Hook for resuming canceled subscription
 */
export function useResumeSubscription() {
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      if (user.role !== 'parent') throw new Error('Seuls les parents peuvent réactiver l\'abonnement');
      return resumeSubscription(user.id);
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({
          queryKey: subscriptionKeys.status(user.id),
        });
      }
    },
  });
}

/**
 * Hook for canceling pending removal (reactivating children scheduled for removal)
 */
export function useCancelPendingRemoval() {
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      if (user.role !== 'parent') throw new Error('Seuls les parents peuvent gérer les abonnements');
      return cancelPendingRemoval(user.id);
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({
          queryKey: subscriptionKeys.status(user.id),
        });
      }
    },
  });
}

/**
 * Combined hook for subscription management
 */
export function useSubscription() {
  const user = useUser();
  const isParent = user?.role === 'parent';

  const status = useSubscriptionStatus();
  const checkout = useCheckoutRedirect();
  const addChildren = useAddChildren();
  const removeChildren = useRemoveChildren();
  const portal = usePortalRedirect();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const cancelPending = useCancelPendingRemoval();

  return {
    // User info
    isParent,

    // Status
    status: status.data as ISubscriptionStatus | undefined,
    isLoading: status.isLoading,
    isError: status.isError,
    error: status.error,
    refetch: status.refetch,

    // Checkout action
    checkout: checkout.mutateAsync,
    isCheckingOut: checkout.isPending,

    // Add children action
    addChildren: addChildren.mutateAsync,
    isAddingChildren: addChildren.isPending,

    // Remove children action
    removeChildren: removeChildren.mutateAsync,
    isRemovingChildren: removeChildren.isPending,

    // Portal action
    openPortal: portal.mutateAsync,
    isOpeningPortal: portal.isPending,

    // Cancel action
    cancelSubscription: cancel.mutateAsync,
    isCanceling: cancel.isPending,

    // Resume action
    resumeSubscription: resume.mutateAsync,
    isResuming: resume.isPending,

    // Cancel pending removal (reactivate children)
    cancelPendingRemoval: cancelPending.mutateAsync,
    isCancelingPendingRemoval: cancelPending.isPending,
  };
}
