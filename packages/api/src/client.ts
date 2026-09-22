/**
 * @repo/api - Eden Treaty Client (type-safe e2e)
 *
 * Type-safe API client using Eden Treaty + Elysia route inference.
 */

import { treaty } from '@elysiajs/eden';
import type { App } from 'tomai-server/app';
import { getApiConfig } from './config';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiError extends Error {
  status: number;
  code?: string;
  suggestions?: string[];
}

/** Callback appelé sur erreur 401 (session invalide) */
export type UnauthorizedHandler = () => void;

// ============================================================================
// UNAUTHORIZED HANDLER
// ============================================================================

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

// ============================================================================
// EDEN TREATY CLIENT (type-safe e2e)
// ============================================================================

export type TreatyClient = ReturnType<typeof treaty<App>>;

let treatyClient: TreatyClient | null = null;

/**
 * Get the Eden Treaty client with full end-to-end type-safety from the server
 * routes. Lazily initialized on first call (requires initializeApi() first).
 *
 * The `App` type comes from the server's *built* declarations
 * (`tomai-server/app` -> dist/types/app.d.ts), so clients get the real route
 * types without type-checking the Bun-flavoured server source. Response bodies
 * (and their types) are derived from this contract — never hand-maintained.
 *
 * @example
 * const decks = unwrap(await getTreaty().api.learning.decks.get()); // typed
 */
export function getTreaty(): TreatyClient {
  if (treatyClient) return treatyClient;

  const config = getApiConfig();

  treatyClient = treaty<App>(config.baseUrl, {
    fetch: {
      credentials: 'include',
      mode: 'cors',
    },
    onResponse: (response) => {
      if (response.status === 401 && unauthorizedHandler) {
        unauthorizedHandler();
      }
    },
  });

  return treatyClient;
}

/**
 * Reset the treaty client (useful after re-initialization).
 * @internal
 */
export function resetTreatyClient(): void {
  treatyClient = null;
}

// ============================================================================
// UNWRAP HELPER
// ============================================================================

function buildApiError(status: number, errorValue: unknown): ApiError {
  let message = `HTTP ${status}`;
  let code: string | undefined;
  let suggestions: string[] | undefined;

  if (errorValue && typeof errorValue === 'object') {
    const ev = errorValue as Record<string, unknown>;

    // New format: { error: { code, message }, requestId? }
    if (ev.error && typeof ev.error === 'object') {
      const errObj = ev.error as Record<string, unknown>;
      message = (errObj.message as string | undefined) ?? message;
      code = (errObj.code as string | undefined) ?? code;
    } else {
      // Legacy format fallback: { message, _error, error, code }
      message =
        (ev.message as string | undefined) ??
        (ev._error as string | undefined) ??
        message;
      code = ev.code as string | undefined;
    }

    suggestions = ev.suggestions as string[] | undefined;
  } else if (typeof errorValue === 'string') {
    message = errorValue;
  }

  const err = new Error(message) as ApiError;
  err.status = status;
  err.code = code;
  err.suggestions = suggestions;
  return err;
}

/**
 * Eden Treaty's discriminated success/failure response, as consumed by `unwrap`.
 * Mirrors `@elysiajs/eden`'s `Treaty.TreatyResponse` (the extra `response` /
 * `status` / `headers` fields are structurally compatible and ignored here).
 */
type TreatyResult<T> =
  | { data: T; error: null }
  | { data: null; error: { status: unknown; value: unknown } };

/**
 * Unwrap an Eden Treaty response: return `data` on success, throw a typed
 * {@link ApiError} on failure. The success type `T` is inferred from the call,
 * so callers never cast:
 *
 * @example
 * const decks = unwrap(await getTreaty().api.learning.decks.get()); // typed
 */
export function unwrap<T>(response: TreatyResult<T>): T {
  if (response.error) {
    const status = typeof response.error.status === 'number' ? response.error.status : 0;
    throw buildApiError(status, response.error.value);
  }
  return response.data;
}

/**
 * The success `data` type of an Eden Treaty endpoint method, for deriving
 * client types from the server contract instead of hand-maintaining them.
 *
 * @example
 * type LearningApi = ReturnType<typeof getTreaty>['api']['learning'];
 * export type LearningDeck = ResponseData<LearningApi['decks']['get']>['decks'][number];
 */
export type ResponseData<Fn extends (...args: never[]) => Promise<{ data: unknown }>> =
  NonNullable<Awaited<ReturnType<Fn>>['data']>;
