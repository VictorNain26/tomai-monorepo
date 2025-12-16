import { createAuthClient } from "better-auth/react";
import type { IAppUser } from '@/types';
import { getBackendURL } from '@/utils/urls';

const baseURL = getBackendURL();

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
