/**
 * Mapping éducatif - Niveaux scolaires français
 * Standards Éducation Nationale 2024-2025
 */

import type { EducationLevelType } from '../../types/index.js';
/**
 * Mapping niveaux scolaires français vers texte descriptif
 * Niveaux scolaires français (Éducation Nationale)
 */
const LEVEL_TEXT_MAPPING: Record<EducationLevelType, string> = {
  cp: 'CP (6 ans)',
  ce1: 'CE1 (7 ans)',
  ce2: 'CE2 (8 ans)',
  cm1: 'CM1 (9 ans)',
  cm2: 'CM2 (10 ans)',
  sixieme: '6ème (11 ans)',
  cinquieme: '5ème (12 ans)',
  quatrieme: '4ème (13 ans)',
  troisieme: '3ème (14 ans)',
  seconde: '2nde (15 ans)',
  premiere: '1ère (16 ans)',
  terminale: 'Terminale (17 ans)'
};

/**
 * Convertit un niveau scolaire en texte descriptif
 * Niveaux scolaires français (Éducation Nationale)
 */
export function getLevelText(level: EducationLevelType): string {
  return LEVEL_TEXT_MAPPING[level] || level;
}

