/**
 * URL Utilities - Architecture sous-domaines
 * Frontend: app.tomia.fr | Backend: api.tomia.fr
 */

/**
 * Récupère l'URL backend API
 * @returns L'URL complète du backend
 */
export const getBackendURL = (): string => {
  // Priority 1: Variable d'environnement explicite
  if (import.meta.env['VITE_API_URL']) {
    return import.meta.env['VITE_API_URL'];
  }

  // Priority 2: Development fallback
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }

  // Priority 3: Production - sous-domaine api.tomia.fr
  return 'https://api.tomia.fr';
};
