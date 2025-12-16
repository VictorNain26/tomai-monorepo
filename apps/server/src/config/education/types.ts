/**
 * Types pour configuration éducative
 * Système éducatif français (Éducation Nationale 2024-2025)
 */

import type { EducationLevelType } from '../../types/index.js';

/**
 * Type de cycle pédagogique français
 */
export type CycleType = 'cycle2' | 'cycle3' | 'cycle4' | 'lycee';

/**
 * Informations sur le cycle pédagogique
 */
export interface CycleInfo {
  cycle: CycleType;
  ageRange: string;
  cognitiveStage: string;
}

/**
 * Configuration de cycle avec niveaux associés
 */
export interface CycleConfig {
  levels: EducationLevelType[];
  ageRange: string;
  cognitiveStage: string;
}
