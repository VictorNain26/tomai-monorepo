/**
 * Education Service — niveaux et matières proposés à l'élève.
 *
 * Source de vérité : la table statique ci-dessous. Elle listait auparavant ce
 * que contenait l'index Qdrant du curriculum ; l'index a été supprimé, la liste
 * reste le contrat que l'app consomme.
 *
 * L'enrichissement UI (emoji, color, description) est fait côté frontend.
 */

import type { EducationLevelType } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

/** @public — reachable only via Eden Treaty's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export interface AvailableLevel {
  key: EducationLevelType;
  available: boolean;
  subjectsCount: number;
}

// =============================================================================
// Constantes
// =============================================================================

const COLLEGE_SUBJECTS = [
  'mathematiques',
  'francais',
  'physique_chimie',
  'svt',
  'histoire_geo',
  'anglais',
  'espagnol',
  'allemand',
  'italien',
  'technologie',
] as const;

/**
 * Matières couvertes par niveau. Élémentaire et lycée sont déclarés mais vides :
 * aucune matière n'y a jamais été servie, et une liste inventée ferait croire à
 * un contenu qui n'existe pas.
 */
const SUBJECTS_BY_LEVEL: Record<EducationLevelType, readonly string[]> = {
  cp: [],
  ce1: [],
  ce2: [],
  cm1: [],
  cm2: [],
  sixieme: COLLEGE_SUBJECTS,
  cinquieme: COLLEGE_SUBJECTS,
  quatrieme: COLLEGE_SUBJECTS,
  troisieme: COLLEGE_SUBJECTS,
  seconde: [],
  premiere: [],
  terminale: [],
};

// =============================================================================
// Service
// =============================================================================

class EducationService {
  /** Niveaux exposés à l'app, avec le nombre de matières de chacun. */
  getAvailableLevels(): AvailableLevel[] {
    return (Object.keys(SUBJECTS_BY_LEVEL) as EducationLevelType[]).map((key) => ({
      key,
      available: SUBJECTS_BY_LEVEL[key].length > 0,
      subjectsCount: SUBJECTS_BY_LEVEL[key].length,
    }));
  }

  /** Matières d'un niveau. Tableau vide si le niveau n'est pas couvert. */
  getSubjectsForLevel(level: EducationLevelType): readonly string[] {
    return SUBJECTS_BY_LEVEL[level] ?? [];
  }
}

export const educationService = new EducationService();
