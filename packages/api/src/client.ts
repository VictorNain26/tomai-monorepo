/**
 * @repo/api - Client HTTP platform-agnostic
 *
 * Client API utilisant fetch natif avec gestion d'erreurs uniforme.
 * Compatible Web (Vite) et Mobile (React Native/Expo).
 */

import { getBaseUrl, getApiConfig } from './config';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Timeout en ms (utilise defaultTimeout si non spécifié) */
  timeout?: number;
}

export interface ApiError extends Error {
  /** Type d'erreur du backend */
  errorType: string;
  /** Détails supplémentaires */
  errorDetails: string;
  /** Code HTTP */
  status: number;
  /** Code d'erreur spécifique (ex: TOPIC_NOT_IN_CURRICULUM) */
  code?: string;
  /** Suggestions du backend */
  suggestions?: string[];
}

/** Callback appelé sur erreur 401 (session invalide) */
export type UnauthorizedHandler = () => void;

// ============================================================================
// CONFIGURATION UPLOAD
// ============================================================================

export const UPLOAD_CONFIG = {
  maxSize: 15 * 1024 * 1024, // 15MB
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
// API CLIENT CLASS
// ============================================================================

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Configure le handler appelé sur erreur 401.
 * Permet à l'app de déconnecter l'utilisateur proprement.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

/**
 * Client API centralisé utilisant fetch natif.
 */
class ApiClient {
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean>
  ): string {
    const url = new URL(endpoint, getBaseUrl());

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return url.toString();
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal as RequestInit['signal'],
        credentials: 'include', // Required for Better Auth cookies
        mode: 'cors',
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async processResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('Content-Type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let errorType = 'GENERAL_ERROR';
      let errorDetails = '';
      let errorCode: string | undefined;
      let errorSuggestions: string[] | undefined;

      if (isJson) {
        try {
          const errorData = (await response.json()) as Record<string, unknown>;
          errorMessage =
            (errorData.message as string | undefined) ??
            (errorData.error as string | undefined) ??
            (errorData._error as string | undefined) ??
            errorMessage;
          errorType = (errorData.errorType as string) ?? 'GENERAL_ERROR';
          errorDetails = (errorData.details as string) ?? '';
          errorCode = errorData.code as string | undefined;
          errorSuggestions = errorData.suggestions as string[] | undefined;
        } catch {
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
      }

      // Handle 401 - Invalid session
      if (response.status === 401 && unauthorizedHandler) {
        unauthorizedHandler();
      }

      const error = new Error(errorMessage) as ApiError;
      error.errorType = errorType;
      error.errorDetails = errorDetails;
      error.status = response.status;
      error.code = errorCode;
      error.suggestions = errorSuggestions;
      throw error;
    }

    if (isJson) {
      return (await response.json()) as T;
    }

    return (await response.text()) as T;
  }

  async get<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);
    const config = getApiConfig();

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: { ...this.defaultHeaders, ...fetchOptions.headers },
        ...fetchOptions,
      },
      timeout ?? config.defaultTimeout
    );

    return this.processResponse<T>(response);
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);
    const config = getApiConfig();

    let body: string | FormData | undefined;
    const headers = { ...this.defaultHeaders };

    if (data instanceof FormData) {
      body = data;
      delete (headers as Record<string, string>)['Content-Type'];
    } else if (data) {
      body = JSON.stringify(data);
    }

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { ...headers, ...fetchOptions.headers },
        ...(body && { body: body as RequestInit['body'] }),
        ...fetchOptions,
      },
      timeout ?? config.defaultTimeout
    );

    return this.processResponse<T>(response);
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);
    const config = getApiConfig();

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'PUT',
        headers: { ...this.defaultHeaders, ...fetchOptions.headers },
        ...(data ? { body: JSON.stringify(data) } : {}),
        ...fetchOptions,
      },
      timeout ?? config.defaultTimeout
    );

    return this.processResponse<T>(response);
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);
    const config = getApiConfig();

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'PATCH',
        headers: { ...this.defaultHeaders, ...fetchOptions.headers },
        ...(data ? { body: JSON.stringify(data) } : {}),
        ...fetchOptions,
      },
      timeout ?? config.defaultTimeout
    );

    return this.processResponse<T>(response);
  }

  async delete<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);
    const config = getApiConfig();

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'DELETE',
        headers: { ...this.defaultHeaders, ...fetchOptions.headers },
        ...fetchOptions,
      },
      timeout ?? config.defaultTimeout
    );

    return this.processResponse<T>(response);
  }

  async upload<T>(
    endpoint: string,
    formData: FormData,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const config = getApiConfig();

    return this.post<T>(endpoint, formData, {
      ...options,
      timeout: options.timeout ?? config.uploadTimeout,
    });
  }

  async chat<T>(
    endpoint: string,
    data: unknown,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const config = getApiConfig();

    return this.post<T>(endpoint, data, {
      ...options,
      timeout: options.timeout ?? config.chatTimeout,
    });
  }
}

// Singleton instance
export const apiClient = new ApiClient();
