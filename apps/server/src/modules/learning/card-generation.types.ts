/**
 * Types pour le service de génération de cartes learning
 *
 * Architecture basée sur les recherches en sciences cognitives :
 * - Retrieval Practice (Roediger & Karpicke, 2006)
 * - Interleaving (Rohrer & Taylor, 2007)
 * - Elaborative Interrogation (Pressley et al., 1987)
 */

import type { EducationLevelType } from '../../types/index.js';
import type { SubjectSlug } from '../../lib/subjects.js';
import type { CostOwner } from '../../platform/ai/cost.js';

// ============================================
// CYCLE SCOLAIRE
// ============================================

/**
 * Cycle scolaire pour adaptation du niveau
 */
export type EducationCycle = 'cycle3' | 'cycle4';

// ============================================
// CONFIGURATION ET PARAMÈTRES
// ============================================

/**
 * Paramètres pour la génération de cartes
 */
export interface CardGenerationParams {
  /** Thème/sous-chapitre du programme (sousdomaine) */
  topic: string;
  subject: SubjectSlug;
  /** Niveau scolaire de l'élève */
  level: EducationLevelType;
  /** Nombre de cartes à générer */
  cardCount: number;
  /** Domaine parent optionnel pour contexte enrichi */
  domaine?: string;
  /** Who the generation is billed to. */
  owner: CostOwner;
}
