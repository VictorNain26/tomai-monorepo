import { createAuthClient } from "better-auth/react";
import type { IAppUser } from '@/types';

// URL resolution améliorée avec fallback robuste
const resolveBaseURL = (): string => {
  // Priority 1: Environment variable
  if (import.meta.env['VITE_BETTER_AUTH_URL']) {
    return import.meta.env['VITE_BETTER_AUTH_URL'];
  }

  // Priority 2: API URL env variable
  if (import.meta.env['VITE_API_URL']) {
    return import.meta.env['VITE_API_URL'];
  }

  // Priority 3: Development fallback
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }

  // Priority 4: Production fallback - construire l'URL backend
  const { protocol, hostname } = window.location;
  // En production, assumer que le backend est sur le même host avec port standard
  return `${protocol}//${hostname}`;
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
