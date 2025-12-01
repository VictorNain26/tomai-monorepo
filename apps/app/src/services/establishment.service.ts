/**
 * Service Frontend - Recherche Établissements Scolaires
 * ====================================================
 *
 * Service client pour la recherche d'établissements français via API Tom
 * Génération d'URLs Pronote officielles avec validation RNE
 *
 * Standards: TypeScript strict, ESLint zero warnings, Clean Architecture
 */

import { apiClient, type ApiResponse } from '@/lib/api-client';
import { getMessage, ERROR_MESSAGES } from '@/constants/messages';

// ===== TYPES FRONTEND STRICTS =====

export interface EstablishmentSearchQuery {
  readonly query: string;
  readonly type?: 'secondary' | 'all';
  readonly limit?: number;
}

export interface EstablishmentData {
  readonly rne: string;
  readonly name: string;
  readonly type: 'college' | 'lycee' | 'autre';
  readonly address: string;
  readonly city: string;
  readonly postalCode: string;
  readonly department: string;
  readonly academy: string;
  readonly pronoteUrl: string;
  readonly status: 'ouvert' | 'ferme';
  // Ajout du type de connexion Pronote (ENT vs Direct)
  readonly pronoteType?: 'ent' | 'direct';
}

export interface EstablishmentSearchResponse {
  readonly success: boolean;
  readonly establishments: readonly EstablishmentData[];
  readonly total: number;
  readonly query: string;
  readonly type: string;
  readonly error?: string;
  readonly message?: string;
}

export interface EstablishmentValidationResponse {
  readonly success: boolean;
  readonly rne?: string;
  readonly isValid?: boolean;
  readonly pronoteUrl?: string;
  readonly error?: string;
  readonly message?: string;
}

// ===== TYPES D'ERREUR =====

export class EstablishmentSearchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'EstablishmentSearchError';
  }
}

export class EstablishmentValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly rne: string
  ) {
    super(message);
    this.name = 'EstablishmentValidationError';
  }
}

// ===== TYPES D'API BACKEND =====

interface EstablishmentApiSearchData {
  establishments: readonly EstablishmentData[];
  total: number;
  query: string;
  type: string;
}

interface _EstablishmentApiValidationData {
  rne?: string;
  isValid?: boolean;
  pronoteUrl?: string;
}

interface _EstablishmentApiHealthData {
  status: string;
}

// ===== UTILITAIRES =====

/**
 * Valide les paramètres de recherche côté client
 */
function validateSearchQuery(query: EstablishmentSearchQuery): { isValid: boolean; error?: string } {
  if (!query.query?.trim()) {
    return { isValid: false, error: 'Terme de recherche requis' };
  }

  if (query.query.trim().length < 3) {
    return { isValid: false, error: 'Le terme de recherche doit contenir au moins 3 caractères' };
  }

  if (query.query.trim().length > 100) {
    return { isValid: false, error: 'Le terme de recherche ne peut dépasser 100 caractères' };
  }

  if (query.limit && (query.limit < 1 || query.limit > 50)) {
    return { isValid: false, error: 'La limite doit être comprise entre 1 et 50' };
  }

  return { isValid: true };
}

/**
 * Valide le format RNE côté client
 */
function validateRNE(rne: string): { isValid: boolean; error?: string } {
  if (!rne?.trim()) {
    return { isValid: false, error: 'Code RNE requis' };
  }

  const rnePattern = /^[0-9]{7}[A-Z]$/;
  if (!rnePattern.test(rne.trim())) {
    return { isValid: false, error: 'Le code RNE doit contenir 7 chiffres suivis d\'une lettre majuscule' };
  }

  return { isValid: true };
}

/**
 * Traite les erreurs API et les transforme en erreurs métier
 */
function handleApiError(error: Error, _operation: string): never {
  // Analyser le message d'erreur pour déterminer le type
  const { message } = error;

  if (message.includes('400')) {
    throw new EstablishmentSearchError(message, 'INVALID_REQUEST', 400);
  } else if (message.includes('404')) {
    const errorMessage = getMessage(ERROR_MESSAGES.establishment.notFound, 'lycee');
    throw new EstablishmentSearchError(errorMessage, 'SERVICE_NOT_FOUND', 404);
  } else if (message.includes('500') || message.includes('503') || message.includes('502')) {
    const errorMessage = getMessage(ERROR_MESSAGES.network.serverError, 'lycee');
    throw new EstablishmentSearchError(errorMessage, 'SERVER_ERROR', 500);
  } else if (message.includes('Network Error') || message.includes('fetch')) {
    const errorMessage = getMessage(ERROR_MESSAGES.network.connectionError, 'lycee');
    throw new EstablishmentSearchError(
      errorMessage,
      'NETWORK_ERROR'
    );
  } else {
    // Erreur générique
    throw new EstablishmentSearchError(
      `API error: ${message}`,
      'API_ERROR'
    );
  }
}

// ===== SERVICE PRINCIPAL =====

export class EstablishmentService {
  private readonly baseUrl = '/api/establishments';

  /**
   * Recherche d'établissements avec validation côté client
   */
  async searchEstablishments(query: EstablishmentSearchQuery): Promise<EstablishmentSearchResponse> {
    try {
      // Validation côté client
      const validation = validateSearchQuery(query);
      if (!validation.isValid) {
        return {
          success: false,
          establishments: [],
          total: 0,
          query: query.query ?? '',
          type: query.type ?? 'secondary',
          error: 'Erreur de validation',
          message: validation.error ?? 'Erreur de validation inconnue'
        };
      }

      // Préparation du body POST selon la nouvelle API
      const requestBody = {
        query: query.query.trim(),
        limit: query.limit ?? 25,
        filters: query.type === 'secondary' ? {
          type: ['college', 'lycee'].includes(query.type) ? query.type : undefined
        } : undefined
      };

      // Appel API POST avec gestion d'erreur
      const response = await apiClient.post<ApiResponse<EstablishmentApiSearchData>>(`${this.baseUrl}/search`, requestBody);

      if (!response.success || !response.data) {
        return {
          success: false,
          establishments: [],
          total: 0,
          query: query.query,
          type: query.type ?? 'secondary',
          error: response.error ?? getMessage(ERROR_MESSAGES.establishment.searchFailed, 'lycee'),
          message: response.message ?? 'Aucune donnée reçue'
        } as EstablishmentSearchResponse;
      }

      // Succès - retour des données
      return {
        success: true,
        establishments: response.data.establishments,
        total: response.data.total,
        query: response.data.query,
        type: query.type ?? 'secondary'
      };

    } catch (error) {
      if (error instanceof EstablishmentSearchError) {
        return {
          success: false,
          establishments: [],
          total: 0,
          query: query.query ?? '',
          type: query.type ?? 'secondary',
          error: error.code,
          message: error.message
        };
      }

      // Gestion des erreurs Axios
      if (error instanceof Error) {
        handleApiError(error, 'searchEstablishments');
      }

      // Erreur inconnue
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        establishments: [],
        total: 0,
        query: query.query ?? '',
        type: query.type ?? 'secondary',
        error: getMessage(ERROR_MESSAGES.generic.unknownError, 'lycee'),
        message: errorMessage
      };
    }
  }

  /**
   * Validation d'un RNE et génération d'URL Pronote
   */
  async validateRNE(rne: string): Promise<EstablishmentValidationResponse> {
    try {
      // Validation côté client
      const validation = validateRNE(rne);
      if (!validation.isValid) {
        throw new EstablishmentValidationError(
          validation.error ?? getMessage(ERROR_MESSAGES.establishment.validationFailed, 'lycee'),
          'INVALID_RNE',
          rne
        );
      }

      // Appel API de validation
      const response = await apiClient.post<ApiResponse<{
        rne: string;
        isValid: boolean;
        pronoteUrl: string;
      }>>(`${this.baseUrl}/validate`, {
        rne: rne.trim().toUpperCase()
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error ?? getMessage(ERROR_MESSAGES.establishment.validationFailed, 'lycee'),
          message: response.message ?? 'Impossible de valider le code RNE'
        };
      }

      // Succès - retour des données de validation
      return {
        success: true,
        rne: response.data.rne,
        isValid: response.data.isValid,
        pronoteUrl: response.data.pronoteUrl
      };

    } catch (error) {
      if (error instanceof EstablishmentValidationError) {
        return {
          success: false,
          error: error.code,
          message: error.message
        };
      }

      // Gestion des erreurs Axios
      if (error instanceof Error) {
        handleApiError(error, 'validateRNE');
      }

      // Erreur inconnue
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: getMessage(ERROR_MESSAGES.generic.unknownError, 'lycee'),
        message: errorMessage
      };
    }
  }

  /**
   * Recherche avec debounce pour usage en temps réel
   */
  private debounceTimer: NodeJS.Timeout | null = null;

  searchWithDebounce(
    query: EstablishmentSearchQuery,
    callback: (result: EstablishmentSearchResponse) => void,
    delay = 300
  ): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(async () => {
      const result = await this.searchEstablishments(query);
      callback(result);
    }, delay);
  }

  /**
   * Annule la recherche en cours (utile pour cleanup)
   */
  cancelPendingSearch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Health check du service d'établissements
   */
  async checkHealth(): Promise<{ available: boolean; error?: string }> {
    try {
      const response = await apiClient.get<ApiResponse<{ status: string }>>(`${this.baseUrl}/health`);
      return {
        available: response.success === true && response.data?.status === 'operational'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        available: false,
        error: errorMessage
      };
    }
  }
}

// ===== EXPORT SINGLETON =====

export const establishmentService = new EstablishmentService();
