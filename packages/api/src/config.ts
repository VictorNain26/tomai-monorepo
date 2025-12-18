/**
 * @repo/api - Configuration API injectable
 *
 * Solution platform-agnostic pour configurer l'URL backend.
 * Fonctionne avec Vite (web), Expo (mobile), et Node.js (SSR).
 *
 * @example
 * // Dans l'app (une seule fois au démarrage)
 * import { initializeApi } from '@repo/api/config';
 *
 * initializeApi({
 *   baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
 * });
 */

export interface ApiConfig {
  /** URL de base du backend API (ex: https://api.tomia.fr) */
  baseUrl: string;
  /** Timeout par défaut en ms (défaut: 30000) */
  defaultTimeout?: number;
  /** Timeout pour les uploads en ms (défaut: 60000) */
  uploadTimeout?: number;
  /** Timeout pour le chat IA en ms (défaut: 120000) */
  chatTimeout?: number;
}

// Configuration singleton
let apiConfig: ApiConfig | null = null;

/**
 * Initialise la configuration API.
 * DOIT être appelé une fois au démarrage de l'application.
 *
 * @throws Error si appelé plusieurs fois
 */
export function initializeApi(config: ApiConfig): void {
  if (apiConfig !== null) {
    console.warn('[API] Configuration already initialized, skipping.');
    return;
  }

  apiConfig = {
    defaultTimeout: 30000,
    uploadTimeout: 60000,
    chatTimeout: 120000,
    ...config,
  };
}

/**
 * Récupère l'URL de base du backend.
 *
 * @throws Error si l'API n'est pas initialisée
 */
export function getBaseUrl(): string {
  if (!apiConfig) {
    throw new Error(
      '[API] Not initialized. Call initializeApi() at app startup.'
    );
  }
  return apiConfig.baseUrl;
}

/**
 * Récupère la configuration complète.
 *
 * @throws Error si l'API n'est pas initialisée
 */
export function getApiConfig(): Required<ApiConfig> {
  if (!apiConfig) {
    throw new Error(
      '[API] Not initialized. Call initializeApi() at app startup.'
    );
  }
  return apiConfig as Required<ApiConfig>;
}

/**
 * Réinitialise la configuration (utile pour les tests).
 * @internal
 */
export function resetApiConfig(): void {
  apiConfig = null;
}
