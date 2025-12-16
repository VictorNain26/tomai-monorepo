/**
 * Eden Treaty Client - TomAI API Client
 *
 * End-to-end type-safe API client powered by Eden Treaty.
 * Types are automatically inferred from the backend Elysia app.
 *
 * @see https://elysiajs.com/eden/treaty/overview
 */

import { treaty } from '@elysiajs/eden';
import type { App } from 'tomai-server/app';
import { getBackendURL } from '@/utils/urls';

/**
 * Eden Treaty client with full type-safety
 *
 * @example
 * // Type-safe API calls with autocomplete:
 * const { data, error } = await api.api.subjects.get({ query: { level: 'college-6' } });
 * const { data: user } = await api.api.users.me.get();
 */
export const api = treaty<App>(getBackendURL(), {
  fetch: {
    credentials: 'include', // Required for Better Auth session cookies
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
