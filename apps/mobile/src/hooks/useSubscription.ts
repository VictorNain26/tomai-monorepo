/**
 * useSubscription Hook
 *
 * React hook for managing RevenueCat subscriptions.
 * Provides subscription status, offerings, and purchase methods.
 *
 * @see https://www.revenuecat.com/docs
 */

import { useEffect, useState, useCallback } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import type { CustomerInfo, PurchasesPackage, PurchasesOffering } from '@/lib/revenuecat';
import {
  getCustomerInfo,
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
  addCustomerInfoUpdateListener,
  hasProEntitlement,
  ENTITLEMENT_ID,
} from '@/lib/revenuecat';

export interface SubscriptionState {
  isLoading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  expirationDate: Date | null;
  willRenew: boolean;
}

export interface SubscriptionActions {
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useSubscription(): SubscriptionState & SubscriptionActions {
  const { info: showInfo } = useConfirm();
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  const isPro = customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;
  const entitlement = customerInfo?.entitlements.active[ENTITLEMENT_ID];
  const expirationDate = entitlement?.expirationDate
    ? new Date(entitlement.expirationDate)
    : null;
  const willRenew = entitlement?.willRenew ?? false;

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [info, currentOffering] = await Promise.all([
        getCustomerInfo(),
        getCurrentOffering(),
      ]);
      setCustomerInfo(info);
      setOffering(currentOffering);
    } catch (error) {
      if (__DEV__) {
        console.error('[useSubscription] Failed to fetch data:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const unsubscribe = addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });

    return unsubscribe;
  }, [fetchData]);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await purchasePackage(pkg);

      if (result) {
        setCustomerInfo(result);
        return result.entitlements.active[ENTITLEMENT_ID] !== undefined;
      }

      return false; // User cancelled
    } catch (error) {
      if (__DEV__) {
        console.error('[useSubscription] Purchase failed:', error);
      }
      showInfo('Erreur', "L'achat a échoué. Veuillez réessayer.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [showInfo]);

  const restore = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await restorePurchases();
      setCustomerInfo(result);

      const restored = result.entitlements.active[ENTITLEMENT_ID] !== undefined;

      if (restored) {
        showInfo('Succès', 'Vos achats ont été restaurés.');
      } else {
        showInfo('Info', 'Aucun achat à restaurer.');
      }

      return restored;
    } catch (error) {
      if (__DEV__) {
        console.error('[useSubscription] Restore failed:', error);
      }
      showInfo('Erreur', 'La restauration a échoué. Veuillez réessayer.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [showInfo]);

  return {
    isLoading,
    isPro,
    customerInfo,
    offering,
    expirationDate,
    willRenew,
    purchase,
    restore,
    refresh: fetchData,
  };
}

/**
 * Simple hook to check if user has Pro entitlement.
 */
export function useIsPro(): { isPro: boolean; isLoading: boolean } {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  return { isPro, isLoading };
}
