/**
 * Utilitaires pour calcul de complexité et budgets adaptatifs
 * Externalisation depuis gemini-simple.service.ts
 */

import type { EducationLevelType } from '../../types/index.js';
import type { CycleType } from '../prompts/types.js';
import {
  TOKEN_CONFIG_BY_CYCLE,
  THINKING_BUDGET_BY_LEVEL,
  THINKING_MULTIPLIER_BY_SUBJECT,
  THINKING_MULTIPLIER_BY_COMPLEXITY,
  COMPLEXITY_INDICATORS,
  COMPLEX_SUBJECTS,
  COMPLEX_QUERY_LENGTH_THRESHOLD,
  MAX_THINKING_BUDGET,
  DEFAULTS,
  type QuestionComplexity,
  type TokenConfig,
  type ThinkingBudgetConfig
} from './complexity-config.js';

/**
 * Calcule la configuration adaptative de tokens basée sur le cycle
 * Extraction de gemini-simple.service.ts lignes 430-477
 */
export function getAdaptiveTokenConfig(cycle: CycleType): TokenConfig {
  const config = TOKEN_CONFIG_BY_CYCLE[cycle] ?? {
    baseTokens: DEFAULTS.baseTokens,
    complexityMultiplier: DEFAULTS.complexityMultiplier
  };

  // Calcul final avec buffer anti-troncature
  const adaptiveMaxTokens = Math.floor(config.baseTokens * config.complexityMultiplier);

  return {
    maxTokens: adaptiveMaxTokens,
    includeKaTeX: false // Sera géré par l'instruction système avec le subject réel
  };
}

/**
 * Détecte la complexité d'une question basée sur indicateurs linguistiques
 * Extraction de gemini-simple.service.ts lignes 832-870
 */
export function detectQuestionComplexity(userQuery: string, subject: string): QuestionComplexity {
  const query = userQuery.toLowerCase();

  // Détection avancée (philosophie, dissertation, démonstration)
  if (COMPLEXITY_INDICATORS.advanced.some(indicator => query.includes(indicator))) {
    return 'advanced';
  }

  // Détection complexe (multi-étapes, raisonnement structuré)
  if (COMPLEXITY_INDICATORS.complex.some(indicator => query.includes(indicator))) {
    return 'complex';
  }

  // Détection simple (questions factuelles)
  if (COMPLEXITY_INDICATORS.simple.some(indicator => query.includes(indicator))) {
    return 'simple';
  }

  // Analyse selon la longueur et la matière
  if (query.length > COMPLEX_QUERY_LENGTH_THRESHOLD ||
      COMPLEX_SUBJECTS.includes(subject.toLowerCase() as typeof COMPLEX_SUBJECTS[number])) {
    return 'complex';
  }

  return DEFAULTS.questionComplexity;
}

/**
 * Calcule le budget thinking mode éducatif adaptatif
 * Extraction de gemini-simple.service.ts lignes 773-827
 */
export function calculateEducationalThinkingBudget(
  level: EducationLevelType,
  subject: string,
  complexity: QuestionComplexity = 'moderate'
): ThinkingBudgetConfig {
  // Budget de base selon le niveau scolaire français
  const baseBudget = THINKING_BUDGET_BY_LEVEL[level] ?? DEFAULTS.thinkingBudget;

  // Ajustement selon la matière
  const subjectKey = subject.toLowerCase();
  const subjectMultiplier = THINKING_MULTIPLIER_BY_SUBJECT[subjectKey] ?? THINKING_MULTIPLIER_BY_SUBJECT['default'] ?? 1.0;

  // Ajustement selon la complexité détectée
  const complexityMultiplier = THINKING_MULTIPLIER_BY_COMPLEXITY[complexity];

  const finalBudget = Math.round(baseBudget * subjectMultiplier * complexityMultiplier);

  // Contraintes selon le modèle (Flash: max 24576)
  const constrainedBudget = Math.min(finalBudget, MAX_THINKING_BUDGET);

  return {
    thinkingBudget: constrainedBudget,
    includeThoughts: true // Toujours inclure pour analyse pédagogique
  };
}

/**
 * Détermine si Thinking Mode doit être activé automatiquement
 * Phase 3: Auto-activation pour problèmes mathématiques complexes (RAPPORT_AUDIT lignes 233-260)
 *
 * @param userQuery - Question de l'utilisateur
 * @param subject - Matière (ex: "mathématiques")
 * @param level - Niveau scolaire
 * @returns true si Thinking Mode doit être activé
 *
 * Activation pour:
 * - Démonstrations mathématiques (Pythagore, Thalès, récurrence)
 * - Problèmes olympiades/challenges
 * - Comparaisons multi-méthodes
 * - Niveaux avancés (Première, Terminale) pour mathématiques
 */
export function shouldUseThinkingMode(
  userQuery: string,
  subject: string,
  level: EducationLevelType
): boolean {
  const queryLower = userQuery.toLowerCase();
  const subjectLower = subject.toLowerCase();

  // Keywords indiquant un problème complexe nécessitant Thinking Mode
  const complexKeywords = [
    'démonstration', 'démontre', 'démontrer',
    'prouve', 'prouver', 'preuve',
    'justifie', 'justifier', 'justification',
    'olympiade', 'olympiades',
    'challenge', 'défi',
    'difficile', 'complexe',
    'plusieurs méthodes', 'compare les méthodes',
    'récurrence', 'par récurrence',
    'absurde', 'par l\'absurde',
    'contraposée', 'par contraposée'
  ];

  // Vérifier présence keywords complexes
  const hasComplexKeyword = complexKeywords.some(kw => queryLower.includes(kw));

  // Niveaux avancés (lycée) avec mathématiques → Thinking Mode par défaut
  const isAdvancedLevel = ['premiere', 'terminale'].includes(level);
  const isMathematics = subjectLower.includes('mathématiques') || subjectLower.includes('maths');

  // Activer Thinking Mode si:
  // - Problème complexe ET mathématiques
  // - OU niveau avancé ET mathématiques
  return (hasComplexKeyword && isMathematics) || (isAdvancedLevel && isMathematics);
}
