/**
 * Configuration adaptative pour le système de flashcards
 *
 * Basé sur:
 * - Recherches Éducation Nationale (Éduscol, DRANE)
 * - Sciences cognitives (Stanislas Dehaene - 4 piliers)
 * - Algorithme FSRS (Free Spaced Repetition Scheduler)
 */

import type { EducationLevelType } from '../../types/index.js';

/**
 * Configuration d'apprentissage par niveau scolaire
 *
 * Paramètres calibrés selon:
 * - Capacités cognitives par âge (attention, mémorisation)
 * - Recherches sur la rétention optimale
 */
interface LearningLevelConfig {
  /** Nombre de cartes par session (adapté à l'attention) */
  cardsPerSession: number;
  /** Taux de rétention cible FSRS (0.0-1.0) */
  retention: number;
  /** Intervalle maximum en jours (limite de consolidation) */
  maxInterval: number;
  /** Durée session recommandée en minutes */
  sessionMinutes: number;
}

/**
 * Configuration FSRS adaptative par niveau scolaire
 *
 * Sources:
 * - DRANE: 10-20 cartes collège
 * - Cepeda et al. (2006): rétention optimale 85-92% selon âge
 */
const LEARNING_CONFIG: Record<EducationLevelType, LearningLevelConfig> = {
  // ═══════════════════════════════════════════════════════════════
  // CYCLE 3 (6ème, 11 ans)
  // Attention en croissance (~25min), début raisonnement abstrait
  // ═══════════════════════════════════════════════════════════════
  sixieme: {
    cardsPerSession: 15,
    retention: 0.88,
    maxInterval: 150, // 5 mois
    sessionMinutes: 25,
  },

  // ═══════════════════════════════════════════════════════════════
  // CYCLE 4 (5ème-3ème, 12-14 ans)
  // Capacité attention adulte (~45min), métacognition développée
  // ═══════════════════════════════════════════════════════════════
  cinquieme: {
    cardsPerSession: 15,
    retention: 0.88,
    maxInterval: 180, // 6 mois
    sessionMinutes: 30,
  },
  quatrieme: {
    cardsPerSession: 18,
    retention: 0.89,
    maxInterval: 270, // 9 mois
    sessionMinutes: 35,
  },
  troisieme: {
    cardsPerSession: 20,
    retention: 0.90,
    maxInterval: 365, // 1 an
    sessionMinutes: 40,
  },
};

/**
 * Helper: récupère la configuration pour un niveau donné
 */
export function getLevelConfig(level: EducationLevelType): LearningLevelConfig {
  return LEARNING_CONFIG[level];
}

