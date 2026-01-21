/**
 * useSubscription Hook
 *
 * React hook for managing RevenueCat subscriptions.
 * Provides subscription status, offerings, and purchase methods.
 *
 * Works in both Expo Go (mock mode) and development builds (real mode).
 *
 * @see https://www.revenuecat.com/docs
 */

import { useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getCustomerInfo,
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
  addCustomerInfoUpdateListener,
  hasProEntitlement,
  isRunningInExpoGo,
  ENTITLEMENT_ID,
} from '@/lib/revenuecat';

// ============================================================================
// TYPES (compatible with both mock and real RevenueCat)
// ============================================================================

interface CustomerInfo {
  originalAppUserId: string;
  entitlements: {
    active: Record<string, { expirationDate?: string; willRenew?: boolean }>;
  };
}

interface Package {
  identifier: string;
  packageType: string;
  product: { priceString: string };
}

interface Offering {
  availablePackages: Package[];
}

export interface SubscriptionState {
  /** Whether subscription data is loading */
  isLoading: boolean;
  /** Whether user has active TomIA Pro entitlement */
  isPro: boolean;
  /** Current customer info from RevenueCat */
  customerInfo: CustomerInfo | null;
  /** Current offering with available packages */
  offering: Offering | null;
  /** Subscription expiration date (null if no subscription) */
  expirationDate: Date | null;
  /** Whether subscription will renew */
  willRenew: boolean;
  /** Whether running in Expo Go (no real purchases) */
  isExpoGo: boolean;
}

export interface SubscriptionActions {
  /** Purchase a package */
  purchase: (pkg: Package) => Promise<boolean>;
  /** Restore previous purchases */
  restore: () => Promise<boolean>;
  /** Refresh subscription status */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing RevenueCat subscriptions.
 *
 * @example
 * ```tsx
 * const { isPro, offering, purchase, isExpoGo } = useSubscription();
 *
 * if (isExpoGo) {
 *   // Show message that purchases require development build
 * } else if (!isPro && offering) {
 *   // Show paywall with offering.availablePackages
 * }
 * ```
 */
export function useSubscription(): SubscriptionState & SubscriptionActions {
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<Offering | null>(null);

  // Check if running in Expo Go
  const isExpoGo = isRunningInExpoGo();

  // Derived state
  const isPro = customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;
  const entitlement = customerInfo?.entitlements.active[ENTITLEMENT_ID];
  const expirationDate = entitlement?.expirationDate
    ? new Date(entitlement.expirationDate)
    : null;
  const willRenew = entitlement?.willRenew ?? false;

  // Fetch subscription data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [info, currentOffering] = await Promise.all([
        getCustomerInfo(),
        getCurrentOffering(),
      ]);
      setCustomerInfo(info as CustomerInfo);
      setOffering(currentOffering as Offering | null);
    } catch (error) {
      if (__DEV__) {
        console.error('[useSubscription] Failed to fetch data:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and listener setup
  useEffect(() => {
    fetchData();

    // Listen for customer info updates
    const unsubscribe = addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info as CustomerInfo);
    });

    return unsubscribe;
  }, [fetchData]);

  // Purchase a package
  const purchase = useCallback(async (pkg: Package): Promise<boolean> => {
    // Purchases not available in Expo Go
    if (isExpoGo) {
      Alert.alert(
        'Non disponible',
        'Les achats in-app ne sont pas disponibles dans Expo Go. Utilisez un development build pour tester.'
      );
      return false;
    }

    try {
      setIsLoading(true);
      const info = await purchasePackage(pkg);

      if (info) {
        setCustomerInfo(info as CustomerInfo);
        return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      }

      return false; // User cancelled
    } catch (error) {
      if (__DEV__) {
        console.error('[useSubscription] Purchase failed:', error);
      }
      Alert.alert(
        'Erreur',
        "L'achat a échoué. Veuillez réessayer."
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isExpoGo]);

  // Restore purchases
  const restore = useCallback(async (): Promise<boolean> => {
    // Restore not available in Expo Go
    if (isExpoGo) {
      Alert.alert(
        'Non disponible',
        'La restauration des achats n\'est pas disponible dans Expo Go.'
      );
      return false;
    }

    try {
      setIsLoading(true);
      const info = await restorePurchases();
      setCustomerInfo(info as CustomerInfo);

      const restored = info.entitlements.active[ENTITLEMENT_ID] !== undefined;

      if (restored) {
        Alert.alert('Succès', 'Vos achats ont été restaurés.');
      } else {
        Alert.alert('Info', 'Aucun achat à restaurer.');
      }

      return restored;
    } catch (error) {
      if (__DEV__) {
        console.error('[useSubscription] Restore failed:', error);
      }
      Alert.alert(
        'Erreur',
        'La restauration a échoué. Veuillez réessayer.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isExpoGo]);

  return {
    isLoading,
    isPro,
    customerInfo,
    offering,
    expirationDate,
    willRenew,
    isExpoGo,
    purchase,
    restore,
    refresh: fetchData,
  };
}

/**
 * Simple hook to check if user has Pro entitlement.
 * Use when you only need to check access without full subscription data.
 */
export function useIsPro(): { isPro: boolean; isLoading: boolean; isExpoGo: boolean } {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isExpoGo = isRunningInExpoGo();

  useEffect(() => {
    let mounted = true;

    hasProEntitlement()
      .then((result) => {
        if (mounted) {
          setIsPro(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsPro(false);
          setIsLoading(false);
        }
      });

    // Listen for updates (no-op in Expo Go)
    const unsubscribe = addCustomerInfoUpdateListener((info) => {
      if (mounted) {
        setIsPro(info.entitlements.active[ENTITLEMENT_ID] !== undefined);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { isPro, isLoading, isExpoGo };
}
