/**
 * Export central de la configuration éducative
 * Point d'entrée unique pour mapping niveaux/cycles français
 */

// Types
export type { CycleType, CycleInfo, CycleConfig } from './types.js';

// Constantes
export { CYCLE_MAPPING, LEVEL_TEXT_MAPPING } from './education-mapping.js';

// Fonctions utilitaires
export { getCycleInfo, getLevelText, getStructuredResponseGuide } from './education-mapping.js';
