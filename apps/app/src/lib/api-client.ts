/**
 * TanStack Query API Client - Tom 2025
 * Client API centralisé remplaçant Axios avec fetch natif et TanStack Query
 */

import { getBackendURL } from '@/utils/urls';
import { logger } from './logger';

// Types pour les options de requête
export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
  timeout?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Interface pour les erreurs API étendues
export interface ApiError extends Error {
  errorType: string;
  errorDetails: string;
  status: number;
  code?: string | undefined; // Error code from backend (e.g., TOPIC_NOT_IN_CURRICULUM)
  suggestions?: string[] | undefined; // Helpful suggestions from backend
}

// Configuration par défaut optimisée
const DEFAULT_TIMEOUT = 30000; // 30 secondes
const UPLOAD_TIMEOUT = 60000; // 1 minute pour uploads (backend traite en <10s normalement)
const CHAT_TIMEOUT = 120000; // 2 minutes pour chat IA (réponses longues)
const PRONOTE_TIMEOUT = 60000; // 1 minute pour Pronote (connexion serveur externe)

// Export timeout for Pronote hooks
export { PRONOTE_TIMEOUT };

// Configuration validation upload centralisée
export const UPLOAD_CONFIG = {
  maxSize: 15 * 1024 * 1024, // 15MB
  allowedTypes: [
    // Images
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    // Audio (aligné avec backend file-upload.routes.ts)
    'audio/wav', 'audio/x-wav',
    'audio/mpeg', 'audio/mp3',
    'audio/aac',
    'audio/ogg',
    'audio/webm', // MediaRecorder principal format
    'audio/flac',
    'audio/aiff', 'audio/x-aiff',
    // Documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ]
} as const;

/**
 * Client API centralisé utilisant fetch natif
 * Optimisé pour TanStack Query avec gestion d'erreur uniforme
 */
export class TanStackApiClient {
  private baseURL: string;
  private defaultHeaders: HeadersInit;

  constructor() {
    this.baseURL = getBackendURL();
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Construction de l'URL avec paramètres
   */
  private buildURL(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const url = new URL(endpoint, this.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return url.toString();
  }

  /**
   * Gestion du timeout pour fetch
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        credentials: 'include', // Important pour Better Auth
        mode: 'cors', // Cohérent avec Better Auth client
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Traitement uniforme des réponses
   */
  private async processResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('Content-Type');
    const isJson = contentType?.includes('application/json');

    // Gestion des erreurs HTTP avec détails explicites
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let errorType = 'GENERAL_ERROR';
      let errorDetails = '';
      let errorCode: string | undefined;
      let errorSuggestions: string[] | undefined;

      if (isJson) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.message ?? errorData.error ?? errorData._error ?? errorMessage;
          errorType = errorData.errorType ?? 'GENERAL_ERROR';
          errorDetails = errorData.details ?? '';
          errorCode = errorData.code;
          errorSuggestions = errorData.suggestions;
        } catch {
          // Fallback si le parsing JSON échoue
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
      }

      // 🚨 CRITICAL: Gestion automatique 401 - Session invalide/orpheline
      if (response.status === 401) {
        logger.warn('Unauthorized request - session invalid or user deleted', {
          status: 401,
          url: response.url,
          operation: 'api-client:unauthorized'
        });

        // Déclencher déconnexion automatique via événement custom
        // Évite dépendance circulaire avec authClient
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }

      logger.error('API Request failed', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        error: errorMessage,
        errorType,
        errorDetails,
        operation: 'api-client:request-failed'
      });

      // Créer erreur avec métadonnées pour le frontend
      const error = new Error(errorMessage) as ApiError;
      error.errorType = errorType;
      error.errorDetails = errorDetails;
      error.status = response.status;
      error.code = errorCode;
      error.suggestions = errorSuggestions;
      throw error;
    }

    // Parsing du contenu de réponse
    if (isJson) {
      return response.json();
    }

    // Pour les réponses non-JSON (fichiers, texte, etc.)
    return response.text() as T;
  }

  /**
   * GET Request
   */
  async get<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildURL(endpoint, params);

    logger.debug('API GET request', { url, params });

    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: { ...this.defaultHeaders, ...fetchOptions.headers },
      ...fetchOptions,
    }, timeout);

    return this.processResponse<T>(response);
  }

  /**
   * POST Request
   */
  async post<T>(endpoint: string, data?: unknown, options: ApiRequestOptions = {}): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildURL(endpoint, params);

    logger.debug('API POST request', { url, hasData: !!data });

    // Gestion du body selon le type de données
    let body: BodyInit | undefined;
    const headers = { ...this.defaultHeaders };

    if (data instanceof FormData) {
      // Pour FormData, laisser le navigateur gérer le Content-Type
      body = data;
      delete (headers as Record<string, string>)['Content-Type'];
    } else if (data) {
      body = JSON.stringify(data);
    }

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { ...headers, ...fetchOptions.headers },
      ...(body && { body }),
      ...fetchOptions,
    }, timeout);

    return this.processResponse<T>(response);
  }

  /**
   * PUT Request
   */
  async put<T>(endpoint: string, data?: unknown, options: ApiRequestOptions = {}): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildURL(endpoint, params);

    logger.debug('API PUT request', { url, hasData: !!data });

    const response = await this.fetchWithTimeout(url, {
      method: 'PUT',
      headers: { ...this.defaultHeaders, ...fetchOptions.headers },
      ...(data ? { body: JSON.stringify(data) } : {}),
      ...fetchOptions,
    }, timeout);

    return this.processResponse<T>(response);
  }

  /**
   * DELETE Request
   */
  async delete<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildURL(endpoint, params);

    logger.debug('API DELETE request', { url });

    const response = await this.fetchWithTimeout(url, {
      method: 'DELETE',
      headers: { ...this.defaultHeaders, ...fetchOptions.headers },
      ...fetchOptions,
    }, timeout);

    return this.processResponse<T>(response);
  }

  /**
   * PATCH Request
   */
  async patch<T>(endpoint: string, data?: unknown, options: ApiRequestOptions = {}): Promise<T> {
    const { params, timeout, ...fetchOptions } = options;
    const url = this.buildURL(endpoint, params);

    logger.debug('API PATCH request', { url, hasData: !!data });

    const response = await this.fetchWithTimeout(url, {
      method: 'PATCH',
      headers: { ...this.defaultHeaders, ...fetchOptions.headers },
      ...(data ? { body: JSON.stringify(data) } : {}),
      ...fetchOptions,
    }, timeout);

    return this.processResponse<T>(response);
  }

  /**
   * Upload de fichier (spécialisé pour FormData) avec validation centralisée
   */
  async upload<T>(endpoint: string, formData: FormData, options: ApiRequestOptions = {}): Promise<T> {
    // Validation côté client si un fichier est présent
    const file = formData.get('file') as File | null;
    if (file) {
      if (file.size > UPLOAD_CONFIG.maxSize) {
        throw new Error('Fichier trop volumineux (max 15MB)');
      }

      if (!UPLOAD_CONFIG.allowedTypes.includes(file.type as (typeof UPLOAD_CONFIG.allowedTypes)[number])) {
        throw new Error('Type de fichier non supporté');
      }
    }

    return this.post<T>(endpoint, formData, {
      ...options,
      // Timeout spécialisé pour uploads
      timeout: options.timeout ?? UPLOAD_TIMEOUT,
    });
  }

  /**
   * Requête spécialisée pour le chat IA avec timeout étendu
   */
  async chatMessage<T>(endpoint: string, data: unknown, options: ApiRequestOptions = {}): Promise<T> {
    logger.debug('Chat API request', { endpoint, hasData: !!data });

    return this.post<T>(endpoint, data, {
      ...options,
      // Timeout spécialisé pour chat IA (réponses longues)
      timeout: options.timeout ?? CHAT_TIMEOUT,
    });
  }
}

// Instance singleton du client API
export const apiClient = new TanStackApiClient();

// Exports pour compatibilité
export default apiClient;
