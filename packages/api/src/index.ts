/**
 * @repo/api - Platform-agnostic API package
 *
 * Shared API logic for Web (Vite) and Mobile (Expo).
 *
 * @example
 * // Initialize at app startup
 * import { initializeApi } from '@repo/api';
 *
 * initializeApi({
 *   baseUrl: 'https://api.tomia.fr', // or import.meta.env.VITE_API_URL
 * });
 *
 * // Use queries with TanStack Query
 * import { parentQueries, queryKeys } from '@repo/api/queries';
 *
 * const { data } = useQuery(parentQueries.dashboard());
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

// Auth (Better Auth hooks)
export {
  useSession,
  useUser,
  useIsAuthenticated,
  useIsAuthLoading,
  signIn,
  signUp,
  signOut,
  signInWithGoogle,
  resetAuthClient,
  type IAppUser,
} from './auth';
