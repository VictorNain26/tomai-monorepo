/**
 * Child Form Validation Schema
 *
 * Zod schema mirroring backend createChildSchema + updateChildSchema.
 * Used with react-hook-form via zodResolver.
 *
 * Date format: user inputs DD/MM/YYYY, converted to YYYY-MM-DD for API.
 */

import { z } from 'zod';
// Level types are defined locally in SCHOOL_LEVELS const

// ============================================================================
// HELPERS
// ============================================================================

/** Auto-format raw numeric input as DD/MM/YYYY */
export function formatDateInput(raw: string, previous: string): string {
  if (raw.length < previous.length) return raw;
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Convert DD/MM/YYYY → YYYY-MM-DD for backend */
export function toIsoDate(display: string): string {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Convert YYYY-MM-DD → DD/MM/YYYY for display */
export function toDisplayDate(iso: string | undefined): string {
  if (!iso) return '';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Get a random integer in [0, max) — not crypto-grade, used for username/password generation */
function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

/** Generate a child-friendly username from name */
export function generateUsername(firstName: string, lastName: string): string {
  const clean = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  const num = randomInt(900) + 100;
  return `${clean(firstName)}${clean(lastName).charAt(0)}${num}`;
}

/** Generate a child-friendly memorable password */
export function generatePassword(): string {
  const adjectives = ['Super', 'Cool', 'Brave', 'Smart', 'Happy', 'Magic'];
  const nouns = ['Lion', 'Chat', 'Ours', 'Etoile', 'Soleil', 'Lune'];
  const adj = adjectives[randomInt(adjectives.length)];
  const noun = nouns[randomInt(nouns.length)];
  const num = randomInt(89) + 10;
  return `${adj}${noun}${num}!`;
}

// ============================================================================
// VALIDATION: DD/MM/YYYY date with age check
// ============================================================================

function isValidFrenchDate(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const [, dayS, monthS, yearS] = match;
  const d = parseInt(dayS, 10);
  const m = parseInt(monthS, 10);
  const y = parseInt(yearS, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getDate() === d && date.getMonth() === m - 1;
}

function isAgeInRange(dateStr: string, min: number, max: number): boolean {
  const [, dayS, monthS, yearS] = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) ?? [];
  if (!dayS) return false;
  const d = parseInt(dayS, 10);
  const m = parseInt(monthS, 10);
  const y = parseInt(yearS, 10);
  const now = new Date();
  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age--;
  return age >= min && age <= max;
}

const frenchDateSchema = z.string()
  .min(10, 'Date de naissance requise')
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Format attendu : JJ/MM/AAAA')
  .refine(isValidFrenchDate, 'Date invalide')
  .refine((d) => isAgeInRange(d, 5, 19), 'Âge doit être entre 5 et 19 ans');

// ============================================================================
// SCHOOL LEVEL
// ============================================================================

const SCHOOL_LEVELS = [
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale',
] as const;

const schoolLevelSchema = z.enum(SCHOOL_LEVELS, {
  error: 'Niveau scolaire requis',
});

// ============================================================================
// SCHEMAS
// ============================================================================

export const createChildFormSchema = z.object({
  firstName: z.string()
    .min(1, 'Prénom requis')
    .max(50, 'Prénom trop long')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Caractères non autorisés'),
  lastName: z.string()
    .min(1, 'Nom requis')
    .max(50, 'Nom trop long')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Caractères non autorisés'),
  dateOfBirth: frenchDateSchema,
  schoolLevel: schoolLevelSchema,
  username: z.string()
    .min(3, 'Minimum 3 caractères')
    .max(30, 'Maximum 30 caractères')
    .regex(/^[a-zA-Z0-9_.]+$/, 'Lettres, chiffres, points, underscores'),
  password: z.string()
    .min(8, 'Minimum 8 caractères')
    .max(128, 'Maximum 128 caractères')
    .regex(/(?=.*[a-z])/, 'Doit contenir une minuscule')
    .regex(/(?=.*[A-Z])/, 'Doit contenir une majuscule')
    .regex(/(?=.*\d)/, 'Doit contenir un chiffre'),
});

export const updateChildFormSchema = z.object({
  firstName: z.string()
    .min(1, 'Prénom requis')
    .max(50, 'Prénom trop long')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Caractères non autorisés'),
  lastName: z.string()
    .min(1, 'Nom requis')
    .max(50, 'Nom trop long')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Caractères non autorisés'),
  dateOfBirth: frenchDateSchema,
  schoolLevel: schoolLevelSchema,
  newPassword: z.string()
    .max(128, 'Maximum 128 caractères')
    .refine(
      (v) => v === '' || (v.length >= 8 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(v)),
      'Min. 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre'
    )
    .optional()
    .or(z.literal('')),
});

export type CreateChildFormData = z.infer<typeof createChildFormSchema>;
export type UpdateChildFormData = z.infer<typeof updateChildFormSchema>;
