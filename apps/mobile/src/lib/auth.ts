/**
 * Better Auth Client for Expo/React Native
 *
 * Uses @better-auth/expo with SecureStore for secure token storage.
 * This replaces the web-based auth from @repo/api for mobile.
 *
 * @see https://www.better-auth.com/docs/integrations/expo
 */

import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { usernameClient } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '@repo/api';

// API URL from environment variable
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
// AUTH CLIENT
// ============================================================================

/**
 * Better Auth client configured for Expo.
 * Uses SecureStore for token persistence and deep links for OAuth.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: 'tomia', // Must match app.config.js scheme
      storagePrefix: 'tomia',
      storage: SecureStore,
    }),
    usernameClient(), // Username login for students
  ],
});

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook pour accéder à la session Better Auth.
 * Retourne { data, isPending, error }.
 */
export function useSession() {
  return authClient.useSession();
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
// ACTIONS
// ============================================================================

/**
 * Connexion avec email/password (parents).
 */
export async function signIn(email: string, password: string) {
  return authClient.signIn.email({ email, password });
}

/**
 * Connexion avec username/password (élèves).
 */
export async function signInWithUsername(username: string, password: string) {
  return authClient.signIn.username({ username, password });
}

/**
 * Inscription avec email/password.
 */
export async function signUp(data: { email: string; password: string; name: string }) {
  return authClient.signUp.email(data);
}

/**
 * Déconnexion.
 */
export async function signOut() {
  return authClient.signOut();
}

/**
 * Connexion avec Google OAuth.
 * Opens browser for OAuth flow, redirects back via deep link.
 */
export async function signInWithGoogle() {
  return authClient.signIn.social({
    provider: 'google',
    // The expoClient plugin handles the callback automatically
  });
}

/**
 * Demande de réinitialisation de mot de passe.
 */
export async function requestPasswordReset(email: string, redirectTo?: string) {
  return apiClient.post('/api/auth/forget-password', { email, redirectTo });
}

/**
 * Réinitialisation du mot de passe avec token.
 */
export async function resetPassword(token: string, newPassword: string) {
  return authClient.resetPassword({
    newPassword,
  });
}
