/**
 * @repo/api - Eden Treaty Client (type-safe e2e)
 *
 * Type-safe API client using Eden Treaty + Elysia route inference.
 * Compatible Web (Vite) et Mobile (React Native/Expo).
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
// CONFIGURATION UPLOAD
// ============================================================================

export const UPLOAD_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB (aligned with backend)
  allowedTypes: [
    // Images
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    // Audio
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/aiff',
    'audio/x-aiff',
    // Documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ],
} as const;

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

type TreatyClient = ReturnType<typeof treaty<App>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TreatyApi = { api: Record<string, any>; [key: string]: unknown };

let treatyClient: TreatyClient | null = null;

/**
 * Get the Eden Treaty client with full type-safety from server routes.
 * Lazily initialized on first call (requires initializeApi() to have been called).
 *
 * @example
 * const { data, error } = await getTreaty().api.parent.dashboard.get();
 * if (error) throw error;
 * return data;
 */
export function getTreaty(): TreatyApi {
  if (treatyClient) return treatyClient;

  const config = getApiConfig();

  treatyClient = treaty<App>(config.baseUrl, {
    fetch: {
      credentials: typeof config.cookieProvider === 'function' ? 'omit' : 'include',
      mode: 'cors',
    },
    headers: () => {
      const headers: Record<string, string> = {};
      if (config.cookieProvider) {
        const cookie = config.cookieProvider();
        if (cookie) headers['Cookie'] = cookie;
      }
      return headers;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrap<T = unknown>(response: any): T {
  const res = response as { data?: unknown; error?: { status?: unknown; value?: unknown } | null };
  if (res.error) {
    const status = typeof res.error.status === 'number' ? res.error.status : 0;
    throw buildApiError(status, res.error.value);
  }
  return res.data as T;
}
