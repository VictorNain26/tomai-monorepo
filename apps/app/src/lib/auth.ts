import { createAuthClient } from "better-auth/react";
import type { IAppUser } from '@/types';

/**
 * Résolution de l'URL du backend API
 * Architecture sous-domaines: app.tomia.fr (frontend) + api.tomia.fr (backend)
 */
const resolveBaseURL = (): string => {
  // Priority 1: Environment variable explicite
  if (import.meta.env['VITE_API_URL']) {
    return import.meta.env['VITE_API_URL'];
  }

  // Priority 2: Development fallback
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }

  // Priority 3: Production - sous-domaine api.tomia.fr
  // Frontend sur app.tomia.fr -> Backend sur api.tomia.fr
  return 'https://api.tomia.fr';
};

const baseURL = resolveBaseURL();

// Better Auth client configuration avec support cross-origin
export const authClient = createAuthClient({
  baseURL,
  // Configuration essentielle pour cookies cross-origin en développement
  fetchOptions: {
    credentials: 'include' // Inclure les cookies dans toutes les requêtes
  }
});

// Export Better Auth hooks
export const { useSession } = authClient;

// Helper hooks propres - Typed for TomIA
export const useUser = (): IAppUser | null => {
  const { data: session } = useSession();
  // Cast to IAppUser since backend adds role and other TomIA fields
  return (session?.user as IAppUser | undefined) ?? null;
};

export const useIsAuthenticated = (): boolean => {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return false;
  }

  return !!session?.user;
};
