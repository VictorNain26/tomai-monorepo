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

import { createEncryptedStorage } from './encrypted-storage';

// ============================================================================
// ONLINE MANAGER
// ============================================================================

/**
 * Track if NetInfo listener has been initialized.
 * CRITICAL: Do NOT initialize at module level - native module may not be ready.
 */
let _netInfoInitialized = false;

/**
 * Initialize the online manager with NetInfo.
 * Call this after React Native bridge is ready (e.g., in useEffect).
 */
export function initializeNetInfo(): void {
  if (_netInfoInitialized) return;

  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(isOnline);
    });
  });

  _netInfoInitialized = true;
  console.log('[QueryClient] NetInfo initialized');
}

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
 * Encrypted AsyncStorage wrapper: values are sealed with ChaCha20-Poly1305
 * under a per-device key pinned in expo-secure-store. GDPR-sensitive data
 * (student conversations, grades, progression) must not sit at rest in
 * plaintext AsyncStorage.
 */
const encryptedStorage = createEncryptedStorage();

/**
 * AsyncStorage persister for query cache.
 * Stores query cache in AsyncStorage for offline access, encrypted at rest.
 */
const asyncStoragePersister = createAsyncStoragePersister({
  storage: encryptedStorage,
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
 * Clear all persisted query cache.
 * Use on logout or data reset.
 */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await AsyncStorage.removeItem('TOMIA_QUERY_CACHE');
}

