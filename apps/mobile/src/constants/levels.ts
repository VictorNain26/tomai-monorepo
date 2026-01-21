/**
 * Education Levels & LV2 Constants
 *
 * Centralized UI data for school levels and LV2 options.
 * Backend only returns keys - this file provides display labels.
 *
 * Source of truth for types: apps/server/src/types/index.ts
 */

// =============================================================================
// Types (aligned with backend)
// =============================================================================

/** Backend EducationLevelType - NO prefixes, uses French words */
export type EducationLevelType =
  | 'cp' | 'ce1' | 'ce2' | 'cm1' | 'cm2'
  | 'sixieme' | 'cinquieme' | 'quatrieme' | 'troisieme'
  | 'seconde' | 'premiere' | 'terminale';

/** Backend Lv2Option - ONLY 3 options */
export type Lv2Option = 'espagnol' | 'allemand' | 'italien';

export type CycleId = 'cycle2' | 'cycle3' | 'cycle4' | 'lycee';

// =============================================================================
// Cycles
// =============================================================================

export const CYCLES: Record<CycleId, {
  label: string;
  description: string;
  levels: EducationLevelType[];
}> = {
  cycle2: {
    label: 'Cycle 2',
    description: 'CP, CE1, CE2',
    levels: ['cp', 'ce1', 'ce2'],
  },
  cycle3: {
    label: 'Cycle 3',
    description: 'CM1, CM2, 6ème',
    levels: ['cm1', 'cm2', 'sixieme'],
  },
  cycle4: {
    label: 'Cycle 4',
    description: '5ème, 4ème, 3ème',
    levels: ['cinquieme', 'quatrieme', 'troisieme'],
  },
  lycee: {
    label: 'Lycée',
    description: '2nde, 1ère, Terminale',
    levels: ['seconde', 'premiere', 'terminale'],
  },
};

// =============================================================================
// Levels
// =============================================================================

export const LEVELS: {
  id: EducationLevelType;
  label: string;
  cycle: CycleId;
}[] = [
  { id: 'cp', label: 'CP', cycle: 'cycle2' },
  { id: 'ce1', label: 'CE1', cycle: 'cycle2' },
  { id: 'ce2', label: 'CE2', cycle: 'cycle2' },
  { id: 'cm1', label: 'CM1', cycle: 'cycle3' },
  { id: 'cm2', label: 'CM2', cycle: 'cycle3' },
  { id: 'sixieme', label: '6ème', cycle: 'cycle3' },
  { id: 'cinquieme', label: '5ème', cycle: 'cycle4' },
  { id: 'quatrieme', label: '4ème', cycle: 'cycle4' },
  { id: 'troisieme', label: '3ème', cycle: 'cycle4' },
  { id: 'seconde', label: 'Seconde', cycle: 'lycee' },
  { id: 'premiere', label: 'Première', cycle: 'lycee' },
  { id: 'terminale', label: 'Terminale', cycle: 'lycee' },
];

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

/** Get display label for a level key (with fallback) */
export function getLevelLabel(key: string): string {
  return LEVEL_LABELS[key as EducationLevelType] ?? key;
}

// =============================================================================
// LV2 Options
// =============================================================================

export const LV2_OPTIONS: { value: Lv2Option; label: string }[] = [
  { value: 'espagnol', label: 'Espagnol' },
  { value: 'allemand', label: 'Allemand' },
  { value: 'italien', label: 'Italien' },
];

/** Levels where LV2 is available (5ème onwards) */
export const LV2_ELIGIBLE_LEVELS: EducationLevelType[] = [
  'cinquieme',
  'quatrieme',
  'troisieme',
  'seconde',
  'premiere',
  'terminale',
];

/** Check if a level is eligible for LV2 */
export function isLv2Eligible(level: string): boolean {
  return LV2_ELIGIBLE_LEVELS.includes(level as EducationLevelType);
}

/** Get LV2 label from value */
export function getLv2Label(value: Lv2Option | null | undefined): string | null {
  if (!value) return null;
  return LV2_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
