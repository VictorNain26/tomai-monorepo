/**
 * @repo/api - Configuration API injectable
 *
 * @example
 * // Dans l'app (une seule fois au démarrage)
 * import { initializeApi } from '@repo/api/config';
 *
 * initializeApi({ baseUrl: window.location.origin });
 */

export interface ApiConfig {
  /**
   * URL absolue du serveur : `window.location.origin` pour le client web, servi sur l'origine de
   * l'API. hono/client construit `$url()` et `$ws()` avec `new URL`, qui refuse un chemin relatif.
   */
  baseUrl: string;
}

let apiConfig: ApiConfig | null = null;

/**
 * Initialise la configuration API.
 * DOIT être appelé une fois au démarrage de l'application.
 */
export function initializeApi(config: ApiConfig): void {
  if (!URL.canParse(config.baseUrl)) {
    throw new Error(`[API] baseUrl must be an absolute URL, got "${config.baseUrl}".`);
  }
  if (apiConfig !== null) {
    console.warn('[API] Configuration already initialized, skipping.');
    return;
  }

  apiConfig = config;
}

/**
 * Récupère l'URL de base du backend.
 *
 * @throws Error si l'API n'est pas initialisée
 */
export function getBaseUrl(): string {
  return getApiConfig().baseUrl;
}

/**
 * Récupère la configuration complète.
 *
 * @throws Error si l'API n'est pas initialisée
 */
export function getApiConfig(): ApiConfig {
  if (!apiConfig) {
    throw new Error('[API] Not initialized. Call initializeApi() at app startup.');
  }
  return apiConfig;
}

/**
 * Réinitialise la configuration (utile pour les tests).
 * @internal
 */
export function resetApiConfig(): void {
  apiConfig = null;
}
