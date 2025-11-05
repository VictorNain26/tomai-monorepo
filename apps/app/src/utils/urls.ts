/**
 * URL Utilities - Utilitaires pour URLs API
 */

/**
 * Récupère l'URL backend API
 * @returns L'URL complète du backend
 */
export const getBackendURL = (): string => {
  return import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';
};
