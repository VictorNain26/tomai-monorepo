/**
 * @repo/api - Better Auth client et hooks
 *
 * Client d'authentification platform-agnostic.
 * Utilise la configuration API pour le baseURL.
 */

import { createAuthClient } from 'better-auth/react';
import { getBaseUrl } from './config';

// ============================================================================
// TYPES
// ============================================================================

export interface IAppUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  role: 'parent' | 'student';
  schoolLevel?: string;
  parentId?: string;
  selectedLv2?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// AUTH CLIENT FACTORY
// ============================================================================

let authClientInstance: ReturnType<typeof createAuthClient> | null = null;

/**
 * Récupère ou crée le client Better Auth.
 * Lazy initialization pour permettre la configuration de l'API d'abord.
 */
function getAuthClient(): ReturnType<typeof createAuthClient> {
  if (!authClientInstance) {
    authClientInstance = createAuthClient({
      baseURL: getBaseUrl(),
      fetchOptions: {
        credentials: 'include',
      },
    });
  }
  return authClientInstance;
}

// ============================================================================
// HOOKS EXPORTÉS
// ============================================================================

/**
 * Hook pour accéder à la session Better Auth.
 * Retourne { data, isPending, error }.
 */
export function useSession() {
  return getAuthClient().useSession();
}

/**
 * Hook pour récupérer l'utilisateur connecté typé TomIA.
 * Retourne null si non connecté ou en chargement.
 */
export function useUser(): IAppUser | null {
  const { data: session } = useSession();
  return (session?.user as IAppUser | undefined) ?? null;
}

/**
 * Hook pour vérifier si l'utilisateur est authentifié.
 * Retourne false pendant le chargement.
 */
export function useIsAuthenticated(): boolean {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return false;
  }

  return !!session?.user;
}

/**
 * Hook pour vérifier si la session est en cours de chargement.
 */
export function useIsAuthLoading(): boolean {
  const { isPending } = useSession();
  return isPending;
}

// ============================================================================
// ACTIONS EXPORTÉES
// ============================================================================

/**
 * Connexion avec email/password.
 */
export async function signIn(email: string, password: string) {
  return getAuthClient().signIn.email({ email, password });
}

/**
 * Inscription avec email/password.
 */
export async function signUp(data: {
  email: string;
  password: string;
  name: string;
}) {
  return getAuthClient().signUp.email(data);
}

/**
 * Déconnexion.
 */
export async function signOut() {
  return getAuthClient().signOut();
}

/**
 * Connexion avec Google OAuth.
 */
export async function signInWithGoogle(callbackURL?: string) {
  return getAuthClient().signIn.social({
    provider: 'google',
    callbackURL,
  });
}

// ============================================================================
// RESET (POUR TESTS)
// ============================================================================

/**
 * Réinitialise le client auth (utile pour les tests).
 * @internal
 */
export function resetAuthClient(): void {
  authClientInstance = null;
}
