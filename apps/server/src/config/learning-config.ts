/**
 * Configuration adaptative pour le système de flashcards
 *
 * Basé sur:
 * - Recherches Éducation Nationale (Éduscol, Primlangues, DRANE)
 * - Sciences cognitives (Stanislas Dehaene - 4 piliers)
 * - Algorithme FSRS (Free Spaced Repetition Scheduler)
 *
 * @see docs/AUDIT_LEARNING_FLASHCARDS.md
 */

import type { EducationLevelType } from '../types/index.js';

/**
 * Configuration d'apprentissage par niveau scolaire
 *
 * Paramètres calibrés selon:
 * - Capacités cognitives par âge (attention, mémorisation)
 * - Recommandations Primlangues pour flashcards
 * - Recherches sur la rétention optimale
 */
export interface LearningLevelConfig {
  /** Nombre de cartes par session (adapté à l'attention) */
  cardsPerSession: number;
  /** Taux de rétention cible FSRS (0.0-1.0) */
  retention: number;
  /** Intervalle maximum en jours (limite de consolidation) */
  maxInterval: number;
  /** Durée session recommandée en minutes */
  sessionMinutes: number;
  /** Cycle scolaire pour groupement */
  cycle: 'cycle2' | 'cycle3' | 'cycle4' | 'lycee';
  /** Âge typique de l'élève */
  ageRange: string;
}

/**
 * Configuration FSRS adaptative par niveau scolaire
 *
 * Sources:
 * - Primlangues: 5-10 flashcards pour primaire, sessions courtes
 * - DRANE: 10-20 cartes collège, 20-30 lycée
 * - Cepeda et al. (2006): rétention optimale 85-92% selon âge
 */
export const LEARNING_CONFIG: Record<EducationLevelType, LearningLevelConfig> = {
  // ═══════════════════════════════════════════════════════════════
  // CYCLE 2 (CP-CE2, 6-8 ans)
  // Attention limitée (~15min), mémoire de travail en développement
  // ═══════════════════════════════════════════════════════════════
  cp: {
    cardsPerSession: 5,
    retention: 0.85,
    maxInterval: 30, // 1 mois max - consolidation fréquente
    sessionMinutes: 10,
    cycle: 'cycle2',
    ageRange: '6 ans',
  },
  ce1: {
    cardsPerSession: 6,
    retention: 0.85,
    maxInterval: 45,
    sessionMinutes: 12,
    cycle: 'cycle2',
    ageRange: '7 ans',
  },
  ce2: {
    cardsPerSession: 8,
    retention: 0.85,
    maxInterval: 60,
    sessionMinutes: 15,
    cycle: 'cycle2',
    ageRange: '8 ans',
  },

  // ═══════════════════════════════════════════════════════════════
  // CYCLE 3 (CM1-6ème, 9-11 ans)
  // Attention en croissance (~25min), début raisonnement abstrait
  // ═══════════════════════════════════════════════════════════════
  cm1: {
    cardsPerSession: 10,
    retention: 0.87,
    maxInterval: 90, // 3 mois
    sessionMinutes: 20,
    cycle: 'cycle3',
    ageRange: '9 ans',
  },
  cm2: {
    cardsPerSession: 12,
    retention: 0.87,
    maxInterval: 120, // 4 mois
    sessionMinutes: 22,
    cycle: 'cycle3',
    ageRange: '10 ans',
  },
  sixieme: {
    cardsPerSession: 15,
    retention: 0.88,
    maxInterval: 150, // 5 mois
    sessionMinutes: 25,
    cycle: 'cycle3',
    ageRange: '11 ans',
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
    cycle: 'cycle4',
    ageRange: '12 ans',
  },
  quatrieme: {
    cardsPerSession: 18,
    retention: 0.89,
    maxInterval: 270, // 9 mois
    sessionMinutes: 35,
    cycle: 'cycle4',
    ageRange: '13 ans',
  },
  troisieme: {
    cardsPerSession: 20,
    retention: 0.90,
    maxInterval: 365, // 1 an
    sessionMinutes: 40,
    cycle: 'cycle4',
    ageRange: '14 ans',
  },

  // ═══════════════════════════════════════════════════════════════
  // LYCÉE (2nde-Terminale, 15-18 ans)
  // Capacités adultes, préparation examens, autonomie
  // ═══════════════════════════════════════════════════════════════
  seconde: {
    cardsPerSession: 20,
    retention: 0.90,
    maxInterval: 365,
    sessionMinutes: 45,
    cycle: 'lycee',
    ageRange: '15 ans',
  },
  premiere: {
    cardsPerSession: 25,
    retention: 0.91,
    maxInterval: 545, // ~18 mois
    sessionMinutes: 50,
    cycle: 'lycee',
    ageRange: '16-17 ans',
  },
  terminale: {
    cardsPerSession: 30,
    retention: 0.92,
    maxInterval: 730, // 2 ans (préparation bac + études sup)
    sessionMinutes: 60,
    cycle: 'lycee',
    ageRange: '17-18 ans',
  },
};

/**
 * Guide vocabulaire par cycle pour génération IA
 *
 * Adapte le langage des cartes à l'âge de l'élève
 */
export const VOCABULARY_GUIDE_BY_CYCLE = {
  cycle2:
    'Utilise des mots simples, des phrases courtes (max 10 mots). ' +
    'Évite le jargon technique. Privilégie les exemples concrets du quotidien.',
  cycle3:
    'Vocabulaire accessible, phrases de 15-20 mots maximum. ' +
    'Introduis le vocabulaire technique progressivement avec définitions simples.',
  cycle4:
    'Vocabulaire scolaire standard du collège. ' +
    'Utilise les termes techniques du programme avec précision.',
  lycee:
    'Vocabulaire académique complet. Précision scientifique requise. ' +
    'Utilise la terminologie officielle des programmes.',
} as const;

/**
 * Helper: récupère la configuration pour un niveau donné
 */
export function getLevelConfig(level: EducationLevelType): LearningLevelConfig {
  return LEARNING_CONFIG[level];
}

/**
 * Helper: récupère le guide vocabulaire pour un niveau
 */
export function getVocabularyGuide(level: EducationLevelType): string {
  const config = LEARNING_CONFIG[level];
  return VOCABULARY_GUIDE_BY_CYCLE[config.cycle];
}

/**
 * Helper: calcule le nombre de cartes recommandé pour une génération
 *
 * @param level Niveau scolaire
 * @param requestedCount Nombre demandé (optionnel)
 * @returns Nombre plafonné selon les recommandations
 */
export function getRecommendedCardCount(
  level: EducationLevelType,
  requestedCount?: number
): number {
  const config = LEARNING_CONFIG[level];
  const maxCards = config.cardsPerSession;

  if (!requestedCount) {
    // Par défaut: 60% du max pour une session équilibrée
    return Math.round(maxCards * 0.6);
  }

  // Plafonner au maximum recommandé
  return Math.min(requestedCount, maxCards);
}
