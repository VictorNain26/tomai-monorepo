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
import * as Constants from 'expo-constants';
import { apiClient } from '@repo/api';

// API URL from environment variable
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Detect if running in Expo Go (no native modules available).
 * In Expo Go, executionEnvironment is 'storeClient'.
 * In dev builds / production, it's 'standalone' or 'bare'.
 */
const isExpoGo = Constants.default.executionEnvironment === 'storeClient';

// Lazy-load native Google Sign-In SDK (only available in dev builds / production)
let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin | null = null;
if (!isExpoGo) {
  try {
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    GoogleSignin?.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
  } catch {
    // Native module not available — fall back to web OAuth
  }
}

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
 * - Dev build / production : SDK natif → idToken → Better Auth
 * - Expo Go : flux web OAuth via navigateur (fallback)
 */
export async function signInWithGoogle() {
  if (GoogleSignin) {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    if (!response.data?.idToken) {
      throw new Error('Google Sign-In failed: no idToken received');
    }

    return authClient.signIn.social({
      provider: 'google',
      idToken: {
        token: response.data.idToken,
      },
    });
  }

  // Fallback: web OAuth via browser (Expo Go)
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: '/',
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

// ============================================================================
// QUICK SWITCH (Parent → Child session swap)
// Architecture: Backend gère les sessions, mobile stocke uniquement le restore token
// Ref: https://www.better-auth.com/docs/integrations/expo
// ============================================================================

/** Clé pour stocker le token de restauration parent (notre propre clé, pas Better Auth) */
const PARENT_RESTORE_TOKEN_KEY = 'tomia_parent_restore_token';

/**
 * Clé de session Better Auth.
 * Format: {storagePrefix}.session_token (voir config expoClient)
 * Better Auth stocke un JSON: {"value": "token", "expires": "ISO date"}
 */
const BETTER_AUTH_SESSION_KEY = 'tomia.session_token';

/**
 * Crée le format JSON attendu par Better Auth pour stocker une session.
 */
function createBetterAuthSessionValue(token: string, expiresAt: string): string {
  return JSON.stringify({
    value: token,
    expires: expiresAt,
  });
}

/**
 * Vérifie si un restore token parent est disponible.
 * Indique que la session actuelle a été lancée depuis un compte parent.
 */
export async function hasParentSessionBackup(): Promise<boolean> {
  try {
    const token = await SecureStore.getItemAsync(PARENT_RESTORE_TOKEN_KEY);
    return !!token;
  } catch {
    return false;
  }
}

/**
 * Restaure la session parent en utilisant le restore token.
 * Appelle le backend pour créer une nouvelle session parent valide.
 */
export async function restoreParentSession(): Promise<boolean> {
  try {
    const restoreToken = await SecureStore.getItemAsync(PARENT_RESTORE_TOKEN_KEY);
    if (!restoreToken) {
      return false;
    }

    // Call backend to create new parent session
    const response = await apiClient.post('/api/parent/restore-session', { restoreToken });

    if (!response.success || !response.sessionToken) {
      return false;
    }

    // Set parent session in Better Auth storage format
    const sessionValue = createBetterAuthSessionValue(
      response.sessionToken,
      response.expiresAt
    );
    await SecureStore.setItemAsync(BETTER_AUTH_SESSION_KEY, sessionValue);

    // Clear restore token
    await SecureStore.deleteItemAsync(PARENT_RESTORE_TOKEN_KEY);

    return true;
  } catch {
    return false;
  }
}

/**
 * Nettoie le restore token parent (si l'enfant se déconnecte).
 */
export async function clearParentSessionBackup(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PARENT_RESTORE_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Lance une session enfant depuis le compte parent (Quick Switch).
 * Le backend crée la session enfant ET un token pour restaurer le parent.
 */
export async function launchChildSession(childId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Call backend to create child session and get parent restore token
    const response = await apiClient.post(`/api/parent/children/${childId}/launch-session`, {});

    if (!response.success || !response.childSessionToken || !response.parentRestoreToken) {
      return { success: false, error: response.error ?? 'Erreur de création de session' };
    }

    // 1. Store parent restore token (our own key, simple string)
    await SecureStore.setItemAsync(PARENT_RESTORE_TOKEN_KEY, response.parentRestoreToken);

    // 2. Set child session in Better Auth storage format
    const sessionValue = createBetterAuthSessionValue(
      response.childSessionToken,
      response.childSessionExpiresAt
    );
    await SecureStore.setItemAsync(BETTER_AUTH_SESSION_KEY, sessionValue);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inattendue',
    };
  }
}
