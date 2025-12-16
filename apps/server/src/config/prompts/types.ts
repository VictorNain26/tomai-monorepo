/**
 * Types partagés pour le système de prompts externalisés
 * Centralise les types utilisés par tous les modules de prompts
 */

import type { EducationLevelType } from '../../types/index.js';
import type { CycleInfo, CycleType } from '../education/types.js';

// Ré-export pour usage externe
export type { EducationLevelType };

// Ré-export types cycle depuis education (source de vérité)
export type { CycleInfo, CycleType };

/**
 * Paramètres pour génération de prompts
 */
export interface PromptGenerationParams {
  level: EducationLevelType;
  levelText: string;
  cycleInfo: CycleInfo;
  subject?: string;
  firstName?: string;
  educationalContext?: string;
}
