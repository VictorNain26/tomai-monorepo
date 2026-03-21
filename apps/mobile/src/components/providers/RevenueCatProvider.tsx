/**
 * RevenueCat Provider
 *
 * Initializes RevenueCat SDK and syncs user ID with Better Auth.
 */

import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/lib/auth';
import { initializeRevenueCat, loginUser, logoutUser } from '@/lib/revenuecat';

interface RevenueCatContextValue {
  isInitialized: boolean;
  error: Error | null;
}

const RevenueCatContext = createContext<RevenueCatContextValue>({
  isInitialized: false,
  error: null,
});

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    initializeRevenueCat()
      .then(() => {
        if (isMounted) setIsInitialized(true);
      })
      .catch((err: unknown) => {
        console.error('[RevenueCatProvider] Init failed:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsInitialized(true);
        }
      });

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    let isMounted = true;

    const syncUser = async () => {
      try {
        if (session?.user?.id) {
          await loginUser(session.user.id);
        } else {
          await logoutUser();
        }
      } catch (err) {
        if (isMounted) {
          console.error('[RevenueCatProvider] User sync failed:', err);
        }
      }
    };

    syncUser();
    return () => { isMounted = false; };
  }, [isInitialized, session?.user?.id]);

  return (
    <RevenueCatContext value={{ isInitialized, error }}>
      {children}
    </RevenueCatContext>
  );
}

export function useRevenueCatStatus(): RevenueCatContextValue {
  return use(RevenueCatContext);
}
