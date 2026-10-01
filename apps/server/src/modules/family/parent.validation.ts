/**
 * Schémas de validation Zod - TomAI
 * Corps des routes enfant, validés par `validate('json', ...)` (platform/http/context.ts)
 */

import { z } from 'zod';

// Schémas de base réutilisables
const passwordSchema = z.string()
  .min(8, 'Mot de passe minimum 8 caractères')
  .max(128, 'Mot de passe maximum 128 caractères')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
    'Mot de passe doit contenir: minuscule, majuscule, chiffre');

const usernameSchema = z.string()
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
const schoolLevelSchema = z.enum([
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
  (data) => Object.keys(data).length > 0,
  { message: 'Au moins un champ doit être fourni pour la mise à jour' }
);
