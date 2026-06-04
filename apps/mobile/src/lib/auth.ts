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
import { adminClient } from 'better-auth/client/plugins';
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
    adminClient(), // Quick Switch: impersonation for parents
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
