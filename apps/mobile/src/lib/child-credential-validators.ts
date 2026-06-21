/**
 * Shared validators for child credential fields (username, password).
 * Single source of truth used by ChildCredentialsFields and add-child validate().
 */

const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export function validateUsername(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Identifiant requis';
  if (trimmed.length < 3) return 'Identifiant : 3 caractères minimum';
  if (trimmed.length > 30) return 'Identifiant : 30 caractères maximum';
  if (!USERNAME_REGEX.test(trimmed)) return 'Identifiant : lettres, chiffres, points, underscores';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Mot de passe requis';
  if (value.length < 8) return 'Mot de passe : 8 caractères minimum';
  if (!PASSWORD_COMPLEXITY_REGEX.test(value)) return 'Mot de passe : majuscule, minuscule, chiffre requis';
  return undefined;
}

export function passwordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak';
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const score = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (score <= 2) return 'weak';
  if (score === 3) return 'medium';
  return 'strong';
}
