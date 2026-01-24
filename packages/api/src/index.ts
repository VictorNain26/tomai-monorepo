/**
 * @repo/api - Platform-agnostic API package
 *
 * Shared API logic for Web (Vite) and Mobile (Expo).
 * 100% platform-agnostic - no browser-only or native-only dependencies.
 *
 * Auth is handled separately by each app:
 * - Web: better-auth/react in apps/app/src/lib/auth.ts
 * - Mobile: @better-auth/expo in apps/mobile/src/lib/auth.ts
 *
 * @example
 * // Initialize at app startup
 * import { initializeApi, apiClient } from '@repo/api';
 *
 * initializeApi({
 *   baseUrl: 'https://api.tomia.fr',
 * });
 *
 * // Use queries with TanStack Query
 * import { parentQueries } from '@repo/api/queries';
 */

// Configuration
export {
  initializeApi,
  getBaseUrl,
  getApiConfig,
  resetApiConfig,
  type ApiConfig,
} from './config';

// HTTP Client
export {
  apiClient,
  setUnauthorizedHandler,
  UPLOAD_CONFIG,
  type ApiRequestOptions,
  type ApiError,
  type UnauthorizedHandler,
} from './client';

// Shared Types (platform-agnostic)
export { type IAppUser } from './types';
