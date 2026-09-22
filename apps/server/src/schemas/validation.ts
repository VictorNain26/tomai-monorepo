/**
 * Schémas de validation Zod - TomAI
 * Validation stricte et typée pour tous les endpoints
 */

import { z } from 'zod';

// Schémas de base réutilisables
export const emailSchema = z.string()
  .email('Format email invalide')
  .max(254, 'Email trop long')
  .toLowerCase()
  .trim();

export const passwordSchema = z.string()
  .min(8, 'Mot de passe minimum 8 caractères')
  .max(128, 'Mot de passe maximum 128 caractères')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
    'Mot de passe doit contenir: minuscule, majuscule, chiffre');

export const usernameSchema = z.string()
  .min(3, 'Username minimum 3 caractères')
  .max(30, 'Username maximum 30 caractères')
  .regex(/^[a-zA-Z0-9_.]+$/, 'Username: lettres, chiffres, points, underscores uniquement')
  .toLowerCase()
  .trim();

const nameSchema = z.string()
  .min(1, 'Nom requis')
  .max(50, 'Nom maximum 50 caractères')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Nom: lettres, espaces, apostrophes, tirets uniquement')
  .trim();

// Niveaux scolaires français - COHÉRENT avec DB enum
export const schoolLevelSchema = z.enum([
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',                    // Primaire
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',    // Collège
  'seconde', 'premiere', 'terminale'                    // Lycée
], {
  error: 'Niveau scolaire invalide'
});

const dateOfBirthSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)')
  .refine((date) => {
    const parsedDate = new Date(date + 'T00:00:00Z'); // UTC pour éviter les problèmes de timezone
    const now = new Date();
    
    // Calcul d'âge précis
    let age = now.getFullYear() - parsedDate.getFullYear();
    const monthDiff = now.getMonth() - parsedDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsedDate.getDate())) {
      age--;
    }
    
    return age >= 5 && age <= 19; // Âges éducation française
  }, 'Âge doit être entre 5 et 19 ans');

const chatContentSchema = z.string()
  .min(1, 'Message requis')
  .max(2000, 'Message maximum 2000 caractères')
  .trim();

const subjectSchema = z.string()
  .min(1, 'Matière requise')
  .max(100, 'Matière maximum 100 caractères')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Matière: lettres, espaces, apostrophes, tirets uniquement')
  .trim();

const sessionIdSchema = z.string()
  .optional()
  .refine((val) => !val || val.length <= 100, 'SessionId trop long');

// ============================================
// SCHÉMAS ENDPOINT AUTHENTICATION
// ============================================

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional()
});

export const loginSchema = z.object({
  email: emailSchema.optional(),
  username: usernameSchema.optional(), 
  password: passwordSchema
}).refine(
  (data) => data.email ?? data.username,
  { message: 'Email ou username requis', path: ['email'] }
);

// ============================================  
// SCHÉMAS CHAT & MESSAGING
// ============================================

export const chatSessionSchema = z.object({
  subject: subjectSchema
});

export const chatMessageSchema = z.object({
  content: chatContentSchema,
  subject: subjectSchema,
  sessionId: sessionIdSchema
});

export const streamChatQuerySchema = z.object({
  message: chatContentSchema,
  subject: subjectSchema,
  sessionId: sessionIdSchema
});



// ============================================
// SCHÉMAS PARENT/CHILDREN MANAGEMENT  
// ============================================

export const createChildSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  username: usernameSchema,
  password: passwordSchema,
  schoolLevel: schoolLevelSchema,
  dateOfBirth: dateOfBirthSchema,
});

export const updateChildSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  // username: EXCLU volontairement - ne doit pas être modifié après création
  password: passwordSchema.optional(),
  schoolLevel: schoolLevelSchema.optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
}).refine(
  (data) => Object.values(data).some(value => value !== undefined),
  { message: 'Au moins un champ doit être fourni pour la mise à jour' }
);

// ============================================
// UTILITAIRES VALIDATION
// ============================================

/**
 * Types pour validation result
 */
export type ValidationSuccess<T> = { success: true; data: T };
export type ValidationError = { success: false; _error: string };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Type guard pour validation _error
 */
export function isValidationError<T>(
  result: ValidationResult<T>
): result is ValidationError {
  return !result.success;
}

/**
 * Helper pour validation avec gestion d'erreur typée
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): ValidationResult<T> {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      const errorMessage = _error.issues
        .map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return { success: false, _error: errorMessage };
    }
    return { success: false, _error: 'Validation failed' };
  }
}

