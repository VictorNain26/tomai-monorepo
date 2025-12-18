/**
 * API Initialization for Mobile
 *
 * Initializes @repo/api with the backend URL.
 * Called once at app startup.
 */

import { initializeApi, setUnauthorizedHandler } from '@repo/api';
import Constants from 'expo-constants';

// Get API URL from Expo config or fallback
const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:3000';

/**
 * Initialize the API client.
 * Call this in _layout.tsx before any API calls.
 */
export function initializeAppApi(): void {
  initializeApi({
    baseUrl: API_URL,
    defaultTimeout: 30000,
    uploadTimeout: 60000,
    chatTimeout: 120000,
  });

  // Handle 401 errors (session expired)
  setUnauthorizedHandler(() => {
    // TODO: Navigate to login screen
    console.warn('[API] Session expired - user should be redirected to login');
  });
}
