/**
 * useSubscription Hook
 *
 * React hook for managing RevenueCat subscriptions.
 * Provides subscription status, offerings, and purchase methods.
 *
 * @see https://www.revenuecat.com/docs
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import type { CustomerInfo, PurchasesPackage, PurchasesOffering } from '@/lib/revenuecat';
import {
  getCustomerInfo,
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
  addCustomerInfoUpdateListener,
  ENTITLEMENT_ID,
} from '@/lib/revenuecat';

interface SubscriptionState {
  isLoading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  expirationDate: Date | null;
  willRenew: boolean;
}

interface SubscriptionActions {
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

// ============================================================================
// CUSTOMER INFO STORE (external store for useSyncExternalStore)
// ============================================================================

/**
 * Module-level cache of the latest CustomerInfo emitted by RevenueCat.
 *
 * useSyncExternalStore requires getSnapshot() to return a referentially stable
 * value between renders when the underlying data has not changed. We therefore
 * keep the latest value in a module-level variable and only mutate it when a
 * new CustomerInfo arrives (either from the RevenueCat listener or from an
 * explicit fetch).
 */
let cachedCustomerInfo: CustomerInfo | null = null;
const customerInfoListeners = new Set<() => void>();
let nativeUnsubscribe: (() => void) | null = null;

function notifyCustomerInfoListeners(): void {
  for (const listener of customerInfoListeners) {
    listener();
  }
}

/**
 * Push a new CustomerInfo into the store and notify subscribers.
 * Skips notifications if the reference is unchanged.
 */
function setCachedCustomerInfo(info: CustomerInfo | null): void {
  if (cachedCustomerInfo === info) return;
  cachedCustomerInfo = info;
  notifyCustomerInfoListeners();
}

/**
 * subscribe() for useSyncExternalStore.
 *
 * The first React subscriber lazily attaches the native RevenueCat listener;
 * the last subscriber to detach removes it. This avoids registering a native
 * listener while no React component is mounted.
 */
function subscribeToCustomerInfo(onStoreChange: () => void): () => void {
  if (customerInfoListeners.size === 0) {
    nativeUnsubscribe = addCustomerInfoUpdateListener((info) => {
      setCachedCustomerInfo(info);
    });
  }

  customerInfoListeners.add(onStoreChange);

  return () => {
    customerInfoListeners.delete(onStoreChange);
    if (customerInfoListeners.size === 0 && nativeUnsubscribe) {
      nativeUnsubscribe();
      nativeUnsubscribe = null;
    }
  };
}

function getCustomerInfoSnapshot(): CustomerInfo | null {
  return cachedCustomerInfo;
}

// ============================================================================
// BOOTSTRAP STATUS STORE (for useIsPro)
// ============================================================================

/**
 * Tracks the global state of the initial CustomerInfo bootstrap fetch shared
 * by all useIsPro consumers. Once 'done', subsequent useIsPro mounts skip the
 * fetch and read directly from the CustomerInfo store cache.
 */
type BootstrapStatus = 'idle' | 'pending' | 'done';

let bootstrapStatus: BootstrapStatus = 'idle';
let bootstrapPromise: Promise<void> | null = null;
const bootstrapListeners = new Set<() => void>();

function getBootstrapStatusSnapshot(): BootstrapStatus {
  return bootstrapStatus;
}

function subscribeToBootstrapStatus(onChange: () => void): () => void {
  bootstrapListeners.add(onChange);
  return () => {
    bootstrapListeners.delete(onChange);
  };
}

function setBootstrapStatus(next: BootstrapStatus): void {
  if (bootstrapStatus === next) return;
  bootstrapStatus = next;
  for (const listener of bootstrapListeners) listener();
}

/**
 * Triggers the one-shot bootstrap fetch. Safe to call from multiple consumers:
 * the fetch is in-flight de-duplicated and only runs once per app session.
 */
function ensureBootstrap(): Promise<void> {
  if (bootstrapStatus === 'done') return Promise.resolve();
  if (bootstrapPromise) return bootstrapPromise;

  setBootstrapStatus('pending');
  bootstrapPromise = getCustomerInfo()
    .then((info) => {
      setCachedCustomerInfo(info);
    })
    .catch(() => {
      // Swallow: failure should still flip loading to false; surface elsewhere.
    })
    .finally(() => {
      setBootstrapStatus('done');
    });

  return bootstrapPromise;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useSubscription(): SubscriptionState & SubscriptionActions {
  const { info: showInfo } = useConfirm();
  // Manual loading flag for user-driven actions (purchase / restore / refresh).
  // Initial-fetch loading is derived from the external stores below to avoid
  // setState-in-effect on mount.
  const [actionLoading, setActionLoading] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  const customerInfo = useSyncExternalStore(
    subscribeToCustomerInfo,
    getCustomerInfoSnapshot,
    getCustomerInfoSnapshot,
  );
  const bootStatus = useSyncExternalStore(
    subscribeToBootstrapStatus,
    getBootstrapStatusSnapshot,
    getBootstrapStatusSnapshot,
  );

  const entitlement = customerInfo?.entitlements.active[ENTITLEMENT_ID];
  const isPro = entitlement !== undefined;
  const expirationDate = entitlement?.expirationDate
    ? new Date(entitlement.expirationDate)
    : null;
  const willRenew = entitlement?.willRenew ?? false;
  const isLoading = actionLoading || (customerInfo === null && bootStatus !== 'done');

  const fetchData = useCallback(async (): Promise<void> => {
    setActionLoading(true);
    try {
      const [info, currentOffering] = await Promise.all([
        getCustomerInfo(),
        getCurrentOffering(),
      ]);
      setCachedCustomerInfo(info);
      setOffering(currentOffering);
    } catch (error) {
      if (__DEV__) {
        console.error('[useSubscription] Failed to fetch data:', error);
      }
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Initial bootstrap: only fire-and-forget side effects, no synchronous
  // setState. Both stores update via async callbacks and propagate through
  // useSyncExternalStore.
  useEffect(() => {
    void ensureBootstrap();
    void getCurrentOffering()
      .then((currentOffering) => setOffering(currentOffering))
      .catch((error: unknown) => {
        if (__DEV__) {
          console.error('[useSubscription] Failed to fetch offering:', error);
        }
      });
  }, []);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      setActionLoading(true);
      try {
        const result = await purchasePackage(pkg);

        if (result) {
          setCachedCustomerInfo(result);
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
        setActionLoading(false);
      }
    },
    [showInfo],
  );

  const restore = useCallback(async (): Promise<boolean> => {
    setActionLoading(true);
    try {
      const result = await restorePurchases();
      setCachedCustomerInfo(result);

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
      setActionLoading(false);
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
 *
 * Subscribes to the shared CustomerInfo + bootstrap-status external stores so
 * no setState happens inside an effect. The effect's only job is to kick off
 * the lazy bootstrap fetch on first mount; the fetch itself updates the
 * stores, which propagate to all subscribed components via React 19's
 * useSyncExternalStore.
 */
export function useIsPro(): { isPro: boolean; isLoading: boolean } {
  const customerInfo = useSyncExternalStore(
    subscribeToCustomerInfo,
    getCustomerInfoSnapshot,
    getCustomerInfoSnapshot,
  );

  const status = useSyncExternalStore(
    subscribeToBootstrapStatus,
    getBootstrapStatusSnapshot,
    getBootstrapStatusSnapshot,
  );

  useEffect(() => {
    void ensureBootstrap();
  }, []);

  const isPro = customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;
  const isLoading = customerInfo === null && status !== 'done';

  return { isPro, isLoading };
}
