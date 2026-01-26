/**
 * TanStack Query Client Configuration
 *
 * Shared query client for the mobile app with offline persistence.
 *
 * Best Practice 2026: AsyncStorage persistence + NetInfo for offline-first.
 * @see https://tanstack.com/query/v5/docs/react/plugins/persistQueryClient
 */

import { QueryClient, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// ============================================================================
// ONLINE MANAGER
// ============================================================================

/**
 * Configure online manager to use NetInfo for network status.
 * TanStack Query doesn't auto-detect network changes on mobile.
 */
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    setOnline(isOnline);
  });
});

// ============================================================================
// QUERY CLIENT
// ============================================================================

/**
 * Query client with offline-first configuration.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline-first: use cache while fetching
      networkMode: 'offlineFirst',

      // Cache times (important for persistence)
      staleTime: 5 * 60 * 1000, // 5 minutes - data is "fresh"
      gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in cache (must match persister maxAge)

      // Retry configuration
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Mobile-specific
      refetchOnWindowFocus: false, // N/A on mobile
      refetchOnReconnect: true, // Refetch when back online
      refetchOnMount: true, // Refetch when component mounts
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
});

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * AsyncStorage persister for query cache.
 * Stores query cache in AsyncStorage for offline access.
 */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'TOMIA_QUERY_CACHE',
  // Throttle writes to avoid excessive storage operations
  throttleTime: 1000,
  // Serialize/deserialize with JSON
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

/**
 * Persister options for PersistQueryClientProvider.
 * maxAge should match gcTime for consistency.
 */
export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours (must match gcTime)
  buster: '1', // Increment to invalidate cache on app updates
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if the app is currently online.
 */
export function isOnline(): boolean {
  return onlineManager.isOnline();
}

/**
 * Manually set online status (useful for testing).
 */
export function setOnline(online: boolean): void {
  onlineManager.setOnline(online);
}

/**
 * Clear all persisted query cache.
 * Use on logout or data reset.
 */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await AsyncStorage.removeItem('TOMIA_QUERY_CACHE');
}

/**
 * Invalidate all queries and refetch.
 * Use when user pulls to refresh.
 */
export async function refreshAllQueries(): Promise<void> {
  await queryClient.invalidateQueries();
}

/**
 * Get cache statistics for debugging.
 */
export function getQueryCacheStats(): {
  queryCount: number;
  mutationCount: number;
} {
  const queryCache = queryClient.getQueryCache();
  const mutationCache = queryClient.getMutationCache();

  return {
    queryCount: queryCache.getAll().length,
    mutationCount: mutationCache.getAll().length,
  };
}
