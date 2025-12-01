/**
 * TanStack Form Configuration - Tom 2025
 * Configuration centralisée pour formulaires avec TypeScript strict
 */

import type { FormValidateFn } from '@tanstack/react-form';
import { getSchoolLevelOptions, type EducationLevelType } from '@/constants/schoolLevels';

// Types de validation français pour Tom
export interface FrenchEducationValidation {
  age: number;
  schoolLevel: string;
  isValidAge: boolean;
  isValidLevel: boolean;
}

// Utilitaires de validation pour le système éducatif français
export const frenchEducationValidators = {
  /**
   * Validation âge étudiant français (6-18 ans)
   */
  validateAge: (dateOfBirth: string): string | undefined => {
    if (!dateOfBirth) return 'La date de naissance est obligatoire';

    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ? age - 1
      : age;

    if (actualAge < 6) return 'Âge minimum : 6 ans (CP)';
    if (actualAge > 18) return 'Âge maximum : 18 ans (Terminale)';

    return undefined;
  },

  /**
   * Validation niveau scolaire français
   */
  validateSchoolLevel: (level: string): string | undefined => {
    if (!level) return 'Le niveau scolaire est obligatoire';

    const validLevels = getSchoolLevelOptions().map(l => l.value);
    if (!validLevels.includes(level as EducationLevelType)) {
      return 'Niveau scolaire invalide pour le système français';
    }

    return undefined;
  },

  /**
   * Validation cohérence âge/niveau scolaire
   */
  validateAgeSchoolLevelCoherence: (age: number, schoolLevel: string): string | undefined => {
    const levelData = getSchoolLevelOptions().find(l => l.value === schoolLevel);
    if (!levelData) return 'Niveau scolaire invalide';

    // Calcul approximatif de l'âge attendu basé sur le niveau
    const levelAgeMap: Record<string, number> = {
      'cp': 6, 'ce1': 7, 'ce2': 8, 'cm1': 9, 'cm2': 10, 'sixieme': 11,
      'cinquieme': 12, 'quatrieme': 13, 'troisieme': 14, 'seconde': 15,
      'premiere': 16, 'terminale': 17
    };

    const expectedAge = levelAgeMap[schoolLevel] || age;
    const ageDiff = Math.abs(age - expectedAge);

    // Tolérance de 2 ans (redoublement ou saut de classe)
    if (ageDiff > 2) {
      return `Incohérence âge/niveau : ${age} ans pour ${levelData.label} (attendu: ${expectedAge} ans ±2)`;
    }

    return undefined;
  },

  /**
   * Validation nom d'utilisateur unique (async)
   */
  validateUniqueUsername: async (username: string): Promise<string | undefined> => {
    if (!username) return 'Le nom d\'utilisateur est obligatoire';
    if (username.length < 3) return 'Minimum 3 caractères';
    if (username.length > 20) return 'Maximum 20 caractères';
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return 'Caractères autorisés : lettres, chiffres, _ et -';
    }

    // Simulation validation async (à remplacer par appel API)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Noms d'utilisateur réservés
    const reserved = ['admin', 'root', 'test', 'user', 'tomai'];
    if (reserved.includes(username.toLowerCase())) {
      return 'Nom d\'utilisateur réservé';
    }

    return undefined;
  }
};

// Types TanStack Form pour Tom
export interface CreateChildFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  schoolLevel: string;
  username: string;
  parentId: string;
}

export interface ParentAuthFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  acceptTerms?: boolean;
}

export interface StudentAuthFormData {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// Configuration par défaut pour les formulaires Tom
export const formDefaults = {
  // Délai de validation async
  asyncValidationDebounce: 300,

  // Messages d'erreur standards
  messages: {
    required: 'Ce champ est obligatoire',
    minLength: (min: number) => `Minimum ${min} caractères`,
    maxLength: (max: number) => `Maximum ${max} caractères`,
    email: 'Adresse email invalide',
    passwordMismatch: 'Les mots de passe ne correspondent pas',
    weakPassword: 'Mot de passe trop faible (8+ caractères, majuscule, chiffre)',
  },

  // Styles Tailwind pour les états de champ
  fieldStyles: {
    base: 'w-full px-3 py-2 border rounded-lg transition-colors focus:outline-hidden focus:ring-2',
    valid: 'border-success/50 focus:ring-success focus:border-success',
    error: 'border-destructive/50 focus:ring-destructive focus:border-destructive',
    default: 'border-border focus:ring-primary focus:border-primary',
  }
};

// Factory pour créer des validateurs combinés
export const createFormValidator = <T>(
  validators: Record<keyof T, (value: T[keyof T]) => string | undefined>
): Record<keyof T, (value: T[keyof T]) => string | undefined> => validators;

// Utilitaire pour les styles de champ adaptatifs
export const getFieldStyles = (hasError: boolean, isDirty: boolean, isValid: boolean) => {
  const { base, valid, error, default: defaultStyle } = formDefaults.fieldStyles;

  if (hasError && isDirty) return `${base} ${error}`;
  if (isValid && isDirty) return `${base} ${valid}`;
  return `${base} ${defaultStyle}`;
};