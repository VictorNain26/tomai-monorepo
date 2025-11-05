/**
 * PasswordStrengthIndicator - Molecule affichage force mot de passe
 *
 * Affiche critères de sécurité avec validation visuelle
 */

import { PasswordCriteria } from '../atoms/PasswordCriteria';

export interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-6 space-y-2">
      <p className="text-sm font-medium text-foreground/90">
        Critères de sécurité :
      </p>
      <div className="space-y-1">
        <PasswordCriteria met={password.length >= 8}>
          Au moins 8 caractères
        </PasswordCriteria>
        <PasswordCriteria met={/[A-Z]/.test(password)}>
          Une lettre majuscule
        </PasswordCriteria>
        <PasswordCriteria met={/[a-z]/.test(password)}>
          Une lettre minuscule
        </PasswordCriteria>
        <PasswordCriteria met={/[0-9]/.test(password)}>
          Un chiffre
        </PasswordCriteria>
      </div>
    </div>
  );
}
