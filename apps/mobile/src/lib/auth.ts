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
import {
  GoogleSignin,
  isSuccessResponse,
  isCancelledResponse,
} from '@react-native-google-signin/google-signin';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

// ============================================================================
// TYPES
// ============================================================================

import type { IAppUser } from '@repo/api/types';

export type { IAppUser };

// ============================================================================
// AUTH CLIENT
// ============================================================================

/**
 * Better Auth client configured for Expo.
 * Uses SecureStore for token persistence and deep links for OAuth.
 *
 * Plugins:
 * - expoClient: Secure storage + deep links for mobile
 * - usernameClient: Child (student) login via Pronote username
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: 'tomia', // Must match app.config.js scheme
      storagePrefix: 'tomia',
      storage: SecureStore,
    }),
    usernameClient(), // Child (student) login via Pronote username
  ],
});

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook pour accéder à la session Better Auth.
 * Retourne { data, isPending, error, refetch }.
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
 * Connexion avec username/password (élèves — Pronote).
 * Requiert le plugin usernameClient côté client et username côté serveur.
 */
export async function signInUsername(username: string, password: string) {
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
 * Also clears Google native session, query cache, and SQLite offline data so
 * a different user on the same device cannot read leftover data.
 */
export async function signOut() {
  await authClient.signOut();
  try {
    await GoogleSignin.signOut();
  } catch {
    // Best-effort: user is already signed out of Better Auth
  }
  try {
    const { clearQueryCache } = await import('./query-client');
    await clearQueryCache();
  } catch (err) {
    console.warn('[Auth] clearQueryCache on signOut failed:', err);
  }
  try {
    const { clearLocalData } = await import('@/db/client');
    await clearLocalData();
  } catch (err) {
    console.warn('[Auth] clearLocalData on signOut failed:', err);
  }
}

/**
 * Traduit les codes d'erreur Better Auth en messages utilisateur.
 */
function translateAuthError(errorMessage: string): string {
  const map: Record<string, string> = {
    'Unable to create user': 'Impossible de creer le compte. Verifiez votre connexion ou essayez avec un autre compte Google.',
    'User already exists': 'Un compte existe deja avec cet email. Connectez-vous plutot.',
    'UNABLE_TO_CREATE_USER': 'Impossible de creer le compte. Verifiez votre connexion ou essayez avec un autre compte Google.',
    'USER_ALREADY_EXISTS': 'Un compte existe deja avec cet email. Connectez-vous plutot.',
  };

  for (const [key, value] of Object.entries(map)) {
    if (errorMessage.includes(key)) return value;
  }
  return errorMessage;
}

/**
 * Connexion avec Google OAuth.
 * - Dev build / production : SDK natif → idToken → Better Auth
 * - Expo Go : flux web OAuth via navigateur (fallback)
 *
 * Returns null if the user cancelled the sign-in flow.
 */
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (isCancelledResponse(response)) {
    return null;
  }

  if (isSuccessResponse(response) && response.data.idToken) {
    const result = await authClient.signIn.social({
      provider: 'google',
      idToken: { token: response.data.idToken },
    });

    if (result.error) {
      return {
        ...result,
        error: {
          ...result.error,
          message: translateAuthError(result.error.message ?? ''),
        },
      };
    }

    return result;
  }

  throw new Error('Google Sign-In: aucun idToken recu');
}

/**
 * Demande de réinitialisation de mot de passe.
 */
export async function requestPasswordReset(email: string, redirectTo?: string) {
  // Better Auth client handles /api/auth/* routes — not typed in Eden Treaty
  return authClient.requestPasswordReset({ email, redirectTo });
}

/**
 * Réinitialisation du mot de passe avec token.
 * Le token provient du deep link email (tomia://auth/reset-password?token=xxx).
 */
export async function resetPassword(token: string, newPassword: string) {
  return authClient.resetPassword({
    newPassword,
    token,
  });
}

