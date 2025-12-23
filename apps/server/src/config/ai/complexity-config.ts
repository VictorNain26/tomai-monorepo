/**
 * Configuration de complexité et budgets adaptatifs pour Gemini
 * Externalisation depuis gemini-simple.service.ts
 * Standards Éducation Nationale 2024-2025 + Gemini 2.5 Flash best practices
 */

import type { EducationLevelType } from '../../types/index.js';
import type { CycleType } from '../prompts/index.js';

/**
 * Type de complexité de question
 */
export type QuestionComplexity = 'simple' | 'moderate' | 'complex' | 'advanced';

/**
 * Configuration adaptative de tokens
 */
export interface TokenConfig {
  maxTokens: number;
  includeKaTeX: boolean;
}

/**
 * Configuration thinking mode
 */
export interface ThinkingBudgetConfig {
  thinkingBudget: number;
  includeThoughts: boolean;
}

/**
 * Configuration de tokens par cycle
 * Extraction de gemini-simple.service.ts lignes 445-469
 */
export const TOKEN_CONFIG_BY_CYCLE: Record<CycleType, { baseTokens: number; complexityMultiplier: number }> = {
  cycle2: {
    baseTokens: 1500,  // CP-CE2 (6-8 ans) - Explications simples mais complètes
    complexityMultiplier: 1.8
  },
  cycle3: {
    baseTokens: 2000,  // CM1-6ème (9-11 ans) - Plus de détails, exemples
    complexityMultiplier: 2.0
  },
  cycle4: {
    baseTokens: 2500,  // 5ème-3ème (12-14 ans) - Raisonnement structuré
    complexityMultiplier: 2.2
  },
  lycee: {
    baseTokens: 3500,  // 2nde-Terminale (15-17 ans) - Complexité maximale
    complexityMultiplier: 2.5
  }
};

/**
 * Budget de base thinking mode par niveau scolaire
 * Extraction de gemini-simple.service.ts lignes 779-792
 */
export const THINKING_BUDGET_BY_LEVEL: Record<EducationLevelType, number> = {
  cp: 512,          // CP - problèmes simples
  ce1: 768,         // CE1 - raisonnement élémentaire
  ce2: 1024,        // CE2 - logique de base
  cm1: 1536,        // CM1 - problèmes multi-étapes
  cm2: 2048,        // CM2 - raisonnement structuré
  sixieme: 3072,    // 6ème - introduction collège
  cinquieme: 4096,  // 5ème - approfondissement
  quatrieme: 6144,  // 4ème - concepts avancés
  troisieme: 8192,  // 3ème - préparation lycée
  seconde: 12288,   // 2nde - raisonnement complexe
  premiere: 16384,  // 1ère - spécialisation
  terminale: 20480  // Terminale - niveau supérieur
};

/**
 * Multiplicateurs de budget thinking par matière
 * Extraction de gemini-simple.service.ts lignes 797-805
 */
export const THINKING_MULTIPLIER_BY_SUBJECT: Record<string, number> = {
  mathematiques: 1.5,   // Maths = raisonnement logique intense
  physique: 1.4,        // Sciences physiques = démarche expérimentale
  philosophie: 1.8,     // Philo = réflexion profonde
  litterature: 1.3,     // Littérature = analyse nuancée
  histoire: 1.2,        // Histoire = contextualisation
  francais: 1.1,        // Français = analyse littéraire
  default: 1.0          // Autres matières
};

/**
 * Multiplicateurs de budget thinking par complexité
 * Extraction de gemini-simple.service.ts lignes 811-816
 */
export const THINKING_MULTIPLIER_BY_COMPLEXITY: Record<QuestionComplexity, number> = {
  simple: 0.7,      // Questions directes
  moderate: 1.0,    // Standard
  complex: 1.5,     // Multi-étapes
  advanced: 2.0     // Raisonnement profond requis
};

/**
 * Indicateurs linguistiques de complexité
 * Extraction de gemini-simple.service.ts lignes 834-847
 */
export const COMPLEXITY_INDICATORS = {
  advanced: [
    'pourquoi', 'expliquer', 'démontrer', 'justifier', 'analyser', 'comparer',
    'synthèse', 'dissertation', 'argumentation', 'problématique'
  ],
  complex: [
    'comment', 'étapes', 'méthode', 'résoudre', 'calculer', 'déduire',
    'plusieurs', 'différents', 'relation entre'
  ],
  simple: [
    'qu\'est-ce que', 'définir', 'donner', 'citer', 'nommer',
    'vrai ou faux', 'oui ou non'
  ]
} as const;

/**
 * Matières nécessitant complexity complexe par défaut
 * Extraction de gemini-simple.service.ts ligne 867
 */
export const COMPLEX_SUBJECTS = ['mathematiques', 'physique', 'philosophie'] as const;

/**
 * Seuil de longueur de requête pour complexity complexe
 * Extraction de gemini-simple.service.ts ligne 867
 */
export const COMPLEX_QUERY_LENGTH_THRESHOLD = 200;

/**
 * Budget thinking maximum selon modèle Gemini 2.5 Flash
 * Extraction de gemini-simple.service.ts ligne 821
 */
export const MAX_THINKING_BUDGET = 24576;

/**
 * Fallback defaults
 */
export const DEFAULTS = {
  baseTokens: 2000,
  complexityMultiplier: 2.0,
  thinkingBudget: 2048,
  questionComplexity: 'moderate' as QuestionComplexity
} as const;
