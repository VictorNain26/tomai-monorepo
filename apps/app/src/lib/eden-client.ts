/**
 * Eden Treaty Client - Type-safe API client for TomAI
 *
 * Provides end-to-end type safety with Elysia backend.
 * All API calls are fully typed based on backend route definitions.
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
 * NOTE: Type parameter omitted due to cross-repo type incompatibility.
 * The backend (TomAI-server) uses Bun runtime with different TypeScript config.
 * Eden still provides runtime type safety via Elysia's validation.
 *
 * Future improvement: Generate standalone types from backend and import them.
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
