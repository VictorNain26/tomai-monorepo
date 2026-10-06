/**
 * @repo/api - typed client (hono/client) for the TomAI server.
 *
 * The `AppType` comes from the server's *built* declarations
 * (`tomai-server/app` -> dist/types/app.d.ts), so clients get the real route
 * types without type-checking the Bun-flavoured server source.
 */

import { hc, type ClientResponse } from 'hono/client';
import type { ClientErrorStatusCode, ServerErrorStatusCode } from 'hono/utils/http-status';
import type { AppType } from 'tomai-server/app';
import type { FieldError } from './types';
import { getApiConfig } from './config';

export interface ApiError extends Error {
  status: number;
  code?: string;
  /** On VALIDATION_ERROR: each field the request got wrong. */
  fields?: FieldError[];
  suggestions?: string[];
}

/** Callback appelé sur erreur 401 (session invalide) */
export type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

function createClient(baseUrl: string) {
  return hc<AppType>(baseUrl, {
    init: { credentials: 'include', mode: 'cors' },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init);
      if (response.status === 401) unauthorizedHandler?.();
      return response;
    },
  });
}

export type ApiClient = ReturnType<typeof createClient>;

let client: ApiClient | null = null;

/**
 * Typed client, lazily created on first call (requires initializeApi() first).
 *
 * @example
 * const decks = await unwrap(await getClient().api.learning.decks.$get());
 */
export function getClient(): ApiClient {
  client ??= createClient(getApiConfig().baseUrl);
  return client;
}

/** @internal */
export function resetClient(): void {
  client = null;
}

function buildApiError(status: number, errorValue: unknown): ApiError {
  let message = `HTTP ${status}`;
  let code: string | undefined;
  let fields: FieldError[] | undefined;
  let suggestions: string[] | undefined;

  if (errorValue && typeof errorValue === 'object') {
    const ev = errorValue as Record<string, unknown>;

    // New format: { error: { code, message, fields? }, requestId? }
    if (ev['error'] && typeof ev['error'] === 'object') {
      const errObj = ev['error'] as Record<string, unknown>;
      message = (errObj['message'] as string | undefined) ?? message;
      code = (errObj['code'] as string | undefined) ?? code;
      if (Array.isArray(errObj['fields'])) fields = errObj['fields'] as FieldError[];
    } else {
      // Legacy format fallback: { message, _error, error, code }
      message =
        (ev['message'] as string | undefined) ??
        (ev['_error'] as string | undefined) ??
        message;
      code = ev['code'] as string | undefined;
    }

    suggestions = ev['suggestions'] as string[] | undefined;
  } else if (typeof errorValue === 'string') {
    message = errorValue;
  }

  const err = new Error(message) as ApiError;
  err.status = status;
  if (code !== undefined) err.code = code;
  if (fields !== undefined) err.fields = fields;
  if (suggestions !== undefined) err.suggestions = suggestions;
  return err;
}

/** Body types of the non-error responses in a typed client response union. */
export type SuccessData<R> =
  R extends ClientResponse<infer T, infer S>
    ? S extends ClientErrorStatusCode | ServerErrorStatusCode ? never : T
    : never;

/**
 * Return the parsed body on success, throw a typed {@link ApiError} otherwise.
 * The success type is inferred from the call, so callers never cast.
 */
export async function unwrap<R extends ClientResponse<unknown>>(response: R): Promise<SuccessData<R>> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw buildApiError(response.status, body);
  }
  return response.json() as Promise<SuccessData<R>>;
}
