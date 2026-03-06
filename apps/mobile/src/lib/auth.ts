/**
 * Better Auth Client for Expo/React Native
 *
 * Uses @better-auth/expo with SecureStore for secure token storage.
 * This replaces the web-based auth from @repo/api for mobile.
 *
 * Quick Switch 2026: Uses Better Auth Admin plugin impersonation
 * - Parent can impersonate their children (server validates relationship)
 * - useSession() automatically updates when switching
 * - stopImpersonating() returns to parent session
 *
 * @see https://www.better-auth.com/docs/integrations/expo
 * @see https://www.better-auth.com/docs/plugins/admin
 */

import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { usernameClient, adminClient } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';
import * as Constants from 'expo-constants';
import { getTreaty, unwrap } from '@repo/api';

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
let isSuccessResponse: typeof import('@react-native-google-signin/google-signin').isSuccessResponse;
let isCancelledResponse: typeof import('@react-native-google-signin/google-signin').isCancelledResponse;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    isSuccessResponse = mod.isSuccessResponse;
    isCancelledResponse = mod.isCancelledResponse;
    GoogleSignin?.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
  } catch (err) {
    console.warn('[Auth] Google native SDK not available, falling back to web OAuth:', err);
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
  createdAt: Date;
  updatedAt: Date;
}

/** Session with impersonation metadata from Better Auth admin plugin */
interface ImpersonatedSession {
  impersonatedBy?: string;
}

// ============================================================================
// AUTH CLIENT
// ============================================================================

/**
 * Better Auth client configured for Expo.
 * Uses SecureStore for token persistence and deep links for OAuth.
 *
 * Plugins:
 * - expoClient: Secure storage + deep links for mobile
 * - usernameClient: Username login for students
 * - adminClient: Quick Switch impersonation (parent → child)
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
    adminClient(),    // Quick Switch: impersonation for parents
    passkeyClient(), // Biometric authentication (WebAuthn/passkeys)
  ],
});

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook pour accéder à la session Better Auth.
 * Retourne { data, isPending, error, refetch }.
 *
 * Quick Switch: La session inclut `impersonatedBy` si en mode impersonation.
 * Après impersonation/stopImpersonating, appeler refetch() pour mettre à jour l'UI.
 * @see https://github.com/better-auth/better-auth/discussions/3860
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
 * Hook pour vérifier si on est en mode impersonation (Quick Switch actif).
 * Retourne l'ID du parent si on est en impersonation, null sinon.
 */
export function useImpersonatedBy(): string | null {
  const { data: session } = useSession();
  // Better Auth admin plugin adds impersonatedBy to session
  return (session?.session as ImpersonatedSession | undefined)?.impersonatedBy ?? null;
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
 * Also clears Google native session so the user can pick a different account next time.
 */
export async function signOut() {
  await authClient.signOut();
  if (GoogleSignin) {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Best-effort: user is already signed out of Better Auth
    }
  }
}

/**
 * Connexion avec Google OAuth.
 * - Dev build / production : SDK natif → idToken → Better Auth
 * - Expo Go : flux web OAuth via navigateur (fallback)
 *
 * Returns null if the user cancelled the sign-in flow.
 */
export async function signInWithGoogle() {
  if (GoogleSignin) {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    // User cancelled — not an error
    if (isCancelledResponse(response)) {
      return null;
    }

    // Success — extract idToken
    if (isSuccessResponse(response) && response.data.idToken) {
      return authClient.signIn.social({
        provider: 'google',
        idToken: { token: response.data.idToken },
      });
    }

    throw new Error('Google Sign-In: aucun idToken reçu');
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
  return unwrap(
    await getTreaty().api.auth['forget-password'].post({ email, redirectTo })
  );
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

// ============================================================================
// QUICK SWITCH (Parent ↔ Child session swap)
// Best Practice 2026: Better Auth Admin plugin impersonation
// - Server validates parent-child relationship via impersonationAllowed hook
// - Client uses built-in impersonateUser/stopImpersonating
// - useSession() auto-updates when switching
// ============================================================================

/**
 * Vérifie si un restore parent est possible (en mode impersonation).
 * Utilise le flag impersonatedBy de Better Auth au lieu d'un token custom.
 */
export async function hasParentSessionBackup(): Promise<boolean> {
  try {
    const session = await authClient.getSession();
    // Check if session has impersonatedBy field (means we're impersonating)
    return !!(session?.data?.session as ImpersonatedSession | undefined)?.impersonatedBy;
  } catch {
    return false;
  }
}

/**
 * Restaure la session parent (arrête l'impersonation).
 * Better Auth gère automatiquement le retour à la session parent originale.
 *
 * Important: Le composant appelant doit appeler refetch() de useSession()
 * après cette opération pour mettre à jour l'état React.
 * @see https://github.com/better-auth/better-auth/discussions/3860
 */
export async function restoreParentSession(): Promise<boolean> {
  try {
    const result = await authClient.admin.stopImpersonating();
    return !result.error;
  } catch {
    return false;
  }
}


/**
 * Lance une session enfant depuis le compte parent (Quick Switch).
 *
 * Better Auth Admin Plugin:
 * - Le serveur vérifie que le parent peut impersonner cet enfant spécifique
 * - La session parent est préservée automatiquement
 * - useSession() retourne l'enfant après impersonation
 * - stopImpersonating() restaure la session parent
 *
 * Important: Le composant appelant doit appeler refetch() de useSession()
 * après cette opération pour mettre à jour l'état React.
 * @see https://github.com/better-auth/better-auth/discussions/3860
 */
export async function launchChildSession(childId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const result = await authClient.admin.impersonateUser({
      userId: childId,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message ?? 'Impossible de lancer la session enfant',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inattendue',
    };
  }
}
