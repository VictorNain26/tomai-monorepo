/**
 * RevenueCat Provider
 *
 * Initializes RevenueCat SDK and syncs user ID with Better Auth.
 * Must wrap the app after AuthGuard to have access to user session.
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/lib/auth';
import {
  initializeRevenueCat,
  loginUser,
  logoutUser,
} from '@/lib/revenuecat';

interface RevenueCatContextValue {
  isInitialized: boolean;
  error: Error | null;
}

const RevenueCatContext = createContext<RevenueCatContextValue>({
  isInitialized: false,
  error: null,
});

interface RevenueCatProviderProps {
  children: ReactNode;
}

/**
 * Provider that initializes RevenueCat and syncs with Better Auth user.
 *
 * - Initializes SDK on mount
 * - Logs in user when authenticated
 * - Logs out user when session ends
 */
export function RevenueCatProvider({ children }: RevenueCatProviderProps) {
  const { data: session } = useSession();
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize RevenueCat SDK
  useEffect(() => {
    initializeRevenueCat()
      .then(() => setIsInitialized(true))
      .catch((err) => {
        console.error('[RevenueCatProvider] Init failed:', err);
        setError(err);
        // Still mark as initialized to not block the app
        setIsInitialized(true);
      });
  }, []);

  // Sync user ID with RevenueCat when session changes
  useEffect(() => {
    if (!isInitialized) return;

    const syncUser = async () => {
      try {
        if (session?.user?.id) {
          // User logged in - sync with RevenueCat
          await loginUser(session.user.id);
        } else {
          // User logged out - reset to anonymous
          await logoutUser();
        }
      } catch (err) {
        console.error('[RevenueCatProvider] User sync failed:', err);
        // Don't set error - this is non-critical
      }
    };

    syncUser();
  }, [isInitialized, session?.user?.id]);

  return (
    <RevenueCatContext.Provider value={{ isInitialized, error }}>
      {children}
    </RevenueCatContext.Provider>
  );
}

/**
 * Hook to access RevenueCat initialization status.
 */
export function useRevenueCatStatus(): RevenueCatContextValue {
  return useContext(RevenueCatContext);
}
