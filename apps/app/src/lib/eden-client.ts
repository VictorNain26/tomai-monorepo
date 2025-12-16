/**
 * Eden Treaty Client - TomAI API Client
 *
 * STATUS: SETUP COMPLETE (Type-safety pending)
 *
 * Eden Treaty provides end-to-end type safety with Elysia backends.
 * Currently configured without full type inference due to cross-repo constraints.
 *
 * CURRENT LIMITATIONS:
 * - Backend (TomAI-server) uses Bun runtime with separate TypeScript config
 * - `exactOptionalPropertyTypes` differs between repos
 * - Cross-repo type import causes compilation errors
 *
 * TO ENABLE FULL TYPE SAFETY:
 * 1. In TomAI-server: bun run scripts/generate-eden-types.ts
 * 2. Copy dist/eden-types.d.ts to apps/app/src/types/
 * 3. Import type: import type { App } from '@/types/eden-types';
 * 4. Update client: export const api = treaty<App>(...)
 *
 * FOR NOW: Use apiClient (src/lib/api-client.ts) for API calls.
 * The apiClient provides:
 * - Robust error handling with ApiError structure
 * - Automatic 401 handling with logout event
 * - Upload validation and specialized timeouts
 *
 * @see https://elysiajs.com/eden/treaty/overview
 */

import { treaty } from '@elysiajs/eden';
import { getBackendURL } from '@/utils/urls';

/**
 * Eden Treaty client instance
 *
 * Configured with:
 * - Dynamic backend URL (dev/prod)
 * - Credentials included for Better Auth cookies
 * - CORS mode for cross-origin requests
 *
 * @example
 * // When types are available:
 * const { data, error } = await api.api.subjects({ level: 'college-6' }).get();
 */
export const api = treaty(getBackendURL(), {
  fetch: {
    credentials: 'include', // CRITICAL: Required for Better Auth session cookies
    mode: 'cors',
  },
});

/**
 * Type export for the Eden client
 * Can be used for typing in hooks and components
 */
export type EdenClient = typeof api;

/**
 * Type helper for extracting response data type from an endpoint
 * Usage: type ProductsData = InferResponse<typeof api.api.products.get>
 */
export type InferResponse<T> = T extends () => Promise<{ data: infer D }>
  ? D
  : never;

/**
 * Type helper for extracting error type from an endpoint
 * Usage: type ProductsError = InferError<typeof api.api.products.get>
 */
export type InferError<T> = T extends () => Promise<{ error: infer E }>
  ? E
  : never;
