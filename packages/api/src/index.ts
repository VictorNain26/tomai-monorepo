/**
 * @repo/api - Platform-agnostic API package
 *
 * Shared API logic for Mobile (Expo).
 * 100% platform-agnostic - no browser-only or native-only dependencies.
 *
 * Auth is handled by:
 * - Mobile: @better-auth/expo in apps/mobile/src/lib/auth.ts
 *
 * @example
 * // Initialize at app startup
 * import { initializeApi, getTreaty, unwrap } from '@repo/api';
 *
 * initializeApi({
 *   baseUrl: 'https://api.tomia.fr',
 * });
 *
 * // Type-safe API calls
 * const data = unwrap(await getTreaty().api.parent.dashboard.get());
 */

// Configuration
export {
  initializeApi,
  getBaseUrl,
  getApiConfig,
  resetApiConfig,
  type ApiConfig,
} from './config';

// Eden Treaty Client
export {
  getTreaty,
  unwrap,
  resetTreatyClient,
  setUnauthorizedHandler,
  UPLOAD_CONFIG,
  type ApiError,
  type UnauthorizedHandler,
  type TreatyClient,
  type ResponseData,
} from './client';

// Shared Types (platform-agnostic)
export {
  type IAppUser,
  type TomChatMessage,
  type TomDataParts,
  type DeckCreatedData,
} from './types';
