/**
 * @repo/api - Platform-agnostic API package
 *
 * Typed client (hono/client) built from the server's `AppType`, shared by the clients.
 *
 * @example
 * // Initialize at app startup
 * import { initializeApi, getClient, unwrap } from '@repo/api';
 *
 * initializeApi({ baseUrl: window.location.origin });
 *
 * // Type-safe API calls
 * const data = await unwrap(await getClient().api.parent.dashboard.$get());
 */

// Configuration
export { initializeApi, getBaseUrl, getApiConfig, resetApiConfig, type ApiConfig } from './config';

// Typed client
export {
  getClient,
  unwrap,
  resetClient,
  setUnauthorizedHandler,
  type ApiClient,
  type SuccessData,
  type ApiError,
  type UnauthorizedHandler,
} from './client';

// Shared Types (platform-agnostic)
export { type IAppUser, type TomChatMessage, type TomDataParts, type DeckCreatedData, type FieldError } from './types';
