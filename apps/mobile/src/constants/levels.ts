/**
 * Education Levels Constants
 *
 * Centralized UI data for school levels.
 * Backend only returns keys - this file provides display labels.
 *
 * Source of truth for types: apps/server/src/types/index.ts
 */

/** Backend EducationLevelType - NO prefixes, uses French words */
export type EducationLevelType =
  | 'cp' | 'ce1' | 'ce2' | 'cm1' | 'cm2'
  | 'sixieme' | 'cinquieme' | 'quatrieme' | 'troisieme'
  | 'seconde' | 'premiere' | 'terminale';

/** Level key → Display label mapping */
export const LEVEL_LABELS: Record<EducationLevelType, string> = {
  cp: 'CP',
  ce1: 'CE1',
  ce2: 'CE2',
  cm1: 'CM1',
  cm2: 'CM2',
  sixieme: '6ème',
  cinquieme: '5ème',
  quatrieme: '4ème',
  troisieme: '3ème',
  seconde: 'Seconde',
  premiere: 'Première',
  terminale: 'Terminale',
};

/** Legacy key → modern key mapping */
const LEGACY_LEVEL_LABELS: Record<string, string> = {
  'primaire-cp': 'CP',
  'primaire-ce1': 'CE1',
  'primaire-ce2': 'CE2',
  'primaire-cm1': 'CM1',
  'primaire-cm2': 'CM2',
  'college-6': '6ème',
  'college-5': '5ème',
  'college-4': '4ème',
  'college-3': '3ème',
  'lycee-2nde': 'Seconde',
  'lycee-1ere': 'Première',
  'lycee-tle': 'Terminale',
};

/** Get display label for a level key (with legacy support and fallback) */
export function getLevelLabel(key: string): string {
  return LEVEL_LABELS[key as EducationLevelType] ?? LEGACY_LEVEL_LABELS[key] ?? key;
}
