/**
 * API Initialization for Mobile
 *
 * Initializes @repo/api with the backend URL.
 * Called once at app startup in useEffect.
 */

import { initializeApi, setUnauthorizedHandler } from '@repo/api';

// API URL from environment variable (Expo best practice)
// @see https://docs.expo.dev/guides/environment-variables/
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Initialize the API client.
 * MUST be called inside useEffect, not at module level.
 */
export function initializeAppApi(): void {
  console.log('[API] Initializing with URL:', API_URL);
  initializeApi({
    baseUrl: API_URL,
    defaultTimeout: 30000,
    uploadTimeout: 60000,
    chatTimeout: 120000,
  });

  // Handle 401 errors - lazy import to avoid early native module access
  setUnauthorizedHandler(() => {
    console.warn('[API] Session expired - redirecting to login');
    // Dynamic import to avoid native module access at module load
    import('expo-router').then(({ router }) => {
      router.replace('/login');
    });
  });
}
