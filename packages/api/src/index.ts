/**
 * @repo/api - Platform-agnostic API package
 *
 * Eden Treaty client typed from the server's `App`, shared by the clients.
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
