/**
 * API Initialization for Mobile
 *
 * Initializes @repo/api with the backend URL and Better Auth cookie injection.
 * Called once at app startup in useEffect.
 *
 * Best Practice 2026: React Native doesn't have browser cookies.
 * We need to manually inject the session cookie from Better Auth's SecureStore.
 * @see https://www.better-auth.com/docs/integrations/expo
 */

import { initializeApi, setUnauthorizedHandler } from '@repo/api';
import { authClient } from './auth';

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
    // React Native cookie injection - Better Auth Expo best practice 2026
    // authClient.getCookie() returns the session cookie stored in SecureStore
    cookieProvider: () => authClient.getCookie(),
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
