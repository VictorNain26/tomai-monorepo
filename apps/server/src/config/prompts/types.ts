/**
 * Types partagés pour le système de prompts externalisés
 * Ré-exports depuis les sources de vérité
 */

import type { EducationLevelType } from '../../types/index.js';
import type { CycleInfo, CycleType } from '../education/types.js';

// Ré-export pour usage externe
export type { EducationLevelType };

// Ré-export types cycle depuis education (source de vérité)
export type { CycleInfo, CycleType };
