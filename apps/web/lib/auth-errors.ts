/**
 * Traductions FR des codes d'erreur Better Auth (BASE_ERROR_CODES, better-auth 1.6).
 * Codes vérifiés dans @better-auth/core/dist/error/codes.mjs (version installée).
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cet email. Connectez-vous plutôt.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Un compte existe déjà avec cet email. Connectez-vous plutôt.",
  INVALID_EMAIL: "Adresse email invalide.",
  PASSWORD_TOO_SHORT: "Le mot de passe est trop court (8 caractères minimum).",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long.",
  USER_NOT_FOUND: "Aucun compte ne correspond à cet email.",
  EMAIL_NOT_VERIFIED: "Email non vérifié. Vérifiez votre boîte de réception.",
};

export function translateAuthError(error: { code?: string; message?: string } | null): string {
  const translated = error?.code ? AUTH_ERROR_MESSAGES[error.code] : undefined;
  return translated ?? "Une erreur est survenue. Réessayez.";
}
