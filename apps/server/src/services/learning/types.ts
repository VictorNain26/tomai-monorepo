/**
 * Types pour le service de génération de cartes learning
 *
 * Architecture basée sur les recherches en sciences cognitives :
 * - Retrieval Practice (Roediger & Karpicke, 2006)
 * - Interleaving (Rohrer & Taylor, 2007)
 * - Elaborative Interrogation (Pressley et al., 1987)
 * - Dual Coding (Paivio, 1986)
 */

import type { EducationLevelType } from '../../types/index.js';

// ============================================
// TYPES DE CARTES PAR CATÉGORIE
// ============================================

/**
 * Types de cartes universels (toutes matières)
 */
export type UniversalCardType = 'flashcard' | 'qcm' | 'vrai_faux';

/**
 * Types de cartes pour les langues (français LV, anglais, espagnol, allemand, italien)
 */
export type LanguageCardType =
  | 'matching'        // Relier mot ↔ traduction
  | 'fill_blank'      // Texte à trous (conjugaison, vocabulaire)
  | 'word_order';     // Remettre les mots dans l'ordre

/**
 * Types de cartes pour les mathématiques et physique-chimie
 */
export type MathScienceCardType =
  | 'calculation';    // Calcul avec étapes intermédiaires

/**
 * Types de cartes pour l'histoire-géographie
 */
export type HistoryGeoCardType =
  | 'timeline'        // Ordonner événements chronologiquement
  | 'matching_era'    // Relier événement ↔ époque/personnage
  | 'cause_effect';   // Identifier cause → conséquence

/**
 * Types de cartes pour les SVT
 */
export type SVTCardType =
  | 'classification'  // Classer éléments dans catégories
  | 'process_order';  // Ordonner étapes d'un processus

/**
 * Types de cartes pour le français
 */
export type FrenchCardType =
  | 'fill_blank'           // Texte à trous (grammaire)
  | 'grammar_transform';   // Transformer phrase (temps, voix, etc.)

/**
 * Tous les types de cartes supportés
 */
export type CardType =
  | UniversalCardType
  | LanguageCardType
  | MathScienceCardType
  | HistoryGeoCardType
  | SVTCardType
  | FrenchCardType;

/**
 * Liste des types valides pour validation
 */
export const VALID_CARD_TYPES: CardType[] = [
  // Universel
  'flashcard', 'qcm', 'vrai_faux',
  // Langues
  'matching', 'fill_blank', 'word_order',
  // Maths/Sciences
  'calculation',
  // Histoire-Géo
  'timeline', 'matching_era', 'cause_effect',
  // SVT
  'classification', 'process_order',
  // Français
  'grammar_transform'
];

// ============================================
// CONTENUS DES CARTES
// ============================================

/**
 * Contenu d'une flashcard classique
 */
export interface FlashcardContent {
  front: string;
  back: string;
}

/**
 * Contenu d'un QCM
 */
export interface QCMContent {
  question: string;
  options: string[];      // 4 options
  correctIndex: number;   // Index de la bonne réponse (0-3)
  explanation: string;
}

/**
 * Contenu d'un Vrai/Faux
 */
export interface VraiFauxContent {
  statement: string;
  isTrue: boolean;
  explanation: string;
}

/**
 * Contenu d'un exercice de matching (association)
 * Usage: Langues (vocabulaire), Histoire (dates/événements)
 */
export interface MatchingContent {
  instruction: string;
  pairs: Array<{
    left: string;    // Mot, événement, date...
    right: string;   // Traduction, description, époque...
  }>;
  // Note: Les paires seront mélangées côté frontend
}

/**
 * Contenu d'un exercice à trous
 * Usage: Langues (conjugaison), Français (grammaire)
 */
export interface FillBlankContent {
  sentence: string;           // Phrase avec ___ pour le trou
  options: string[];          // Options possibles (4 max)
  correctIndex: number;       // Index de la bonne réponse
  grammaticalPoint?: string;  // Point de grammaire testé
  explanation: string;
}

/**
 * Contenu d'un exercice de remise en ordre de mots
 * Usage: Langues (construction de phrases)
 */
export interface WordOrderContent {
  instruction: string;
  words: string[];           // Mots mélangés
  correctSentence: string;   // Phrase correcte
  translation?: string;      // Traduction (pour langues étrangères)
}

/**
 * Contenu d'un exercice de calcul avec étapes
 * Usage: Mathématiques, Physique-Chimie
 */
export interface CalculationContent {
  problem: string;           // Énoncé du problème (peut contenir KaTeX)
  steps: string[];           // Étapes de résolution
  answer: string;            // Réponse finale (peut contenir KaTeX)
  hint?: string;             // Indice optionnel
}

/**
 * Contenu d'un exercice de chronologie
 * Usage: Histoire
 */
export interface TimelineContent {
  instruction: string;
  events: Array<{
    event: string;           // Nom de l'événement
    date?: string;           // Date (révélée après réponse)
    hint?: string;           // Indice optionnel
  }>;
  correctOrder: number[];    // Indices dans l'ordre correct
}

/**
 * Contenu d'un exercice d'association époque/événement
 * Usage: Histoire-Géo
 */
export interface MatchingEraContent {
  instruction: string;
  items: string[];           // Personnages, événements, œuvres...
  eras: string[];            // Époques, siècles, périodes...
  correctPairs: number[][];  // [[itemIndex, eraIndex], ...]
}

/**
 * Contenu d'un exercice cause-effet
 * Usage: Histoire-Géo, SVT
 */
export interface CauseEffectContent {
  context: string;           // Contexte historique/scientifique
  cause: string;             // La cause à analyser
  possibleEffects: string[]; // Effets possibles (4 options)
  correctIndex: number;      // Index du bon effet
  explanation: string;
}

/**
 * Contenu d'un exercice de classification
 * Usage: SVT, Sciences
 */
export interface ClassificationContent {
  instruction: string;
  items: string[];           // Éléments à classer
  categories: string[];      // Catégories disponibles
  correctClassification: Record<string, number[]>; // { "categorie": [indices des items] }
  explanation?: string;
}

/**
 * Contenu d'un exercice d'ordre de processus
 * Usage: SVT (digestion, respiration...), Sciences
 */
export interface ProcessOrderContent {
  instruction: string;
  processName: string;       // Nom du processus (ex: "La digestion")
  steps: string[];           // Étapes mélangées
  correctOrder: number[];    // Indices dans l'ordre correct
  explanation?: string;
}

/**
 * Contenu d'un exercice de transformation grammaticale
 * Usage: Français
 */
export interface GrammarTransformContent {
  instruction: string;       // Ex: "Mets cette phrase au passé composé"
  originalSentence: string;  // Phrase originale
  transformationType: 'tense' | 'voice' | 'form' | 'number'; // Type de transformation
  correctAnswer: string;     // Réponse correcte
  acceptableVariants?: string[]; // Variantes acceptables
  explanation: string;
}

/**
 * Union de tous les contenus possibles
 */
export type CardContent =
  | FlashcardContent
  | QCMContent
  | VraiFauxContent
  | MatchingContent
  | FillBlankContent
  | WordOrderContent
  | CalculationContent
  | TimelineContent
  | MatchingEraContent
  | CauseEffectContent
  | ClassificationContent
  | ProcessOrderContent
  | GrammarTransformContent;

// ============================================
// CATÉGORIES DE MATIÈRES
// ============================================

/**
 * Catégories de matières pour adaptation du prompt
 */
export type SubjectCategory =
  | 'mathematiques'      // KaTeX, formules, calculs
  | 'sciences'           // KaTeX + expériences, SVT, physique-chimie
  | 'francais'           // Textes, grammaire, vocabulaire, littérature
  | 'langues'            // Vocabulaire, conjugaison, expressions (LV1, LV2)
  | 'histoire-geo'       // Dates, événements, cartes mentales
  | 'autre';             // Générique (arts, musique, etc.)

/**
 * Types de cartes recommandés par catégorie de matière
 */
export const CARD_TYPES_BY_CATEGORY: Record<SubjectCategory, CardType[]> = {
  mathematiques: ['flashcard', 'qcm', 'vrai_faux', 'calculation'],
  sciences: ['flashcard', 'qcm', 'vrai_faux', 'calculation', 'classification', 'process_order'],
  francais: ['flashcard', 'qcm', 'vrai_faux', 'fill_blank', 'grammar_transform'],
  langues: ['flashcard', 'qcm', 'matching', 'fill_blank', 'word_order'],
  'histoire-geo': ['flashcard', 'qcm', 'vrai_faux', 'timeline', 'matching_era', 'cause_effect'],
  autre: ['flashcard', 'qcm', 'vrai_faux']
};

// ============================================
// CYCLE SCOLAIRE
// ============================================

/**
 * Cycle scolaire pour adaptation du niveau
 */
export type EducationCycle = 'cycle2' | 'cycle3' | 'cycle4' | 'lycee';

// ============================================
// CONFIGURATION ET PARAMÈTRES
// ============================================

/**
 * Configuration par matière
 */
export interface SubjectConfig {
  /** Catégorie de la matière */
  category: SubjectCategory;
  /** Nécessite KaTeX pour les formules */
  requiresKaTeX: boolean;
  /** Instructions spécifiques pour cette matière */
  instructions: string;
  /** Types de cartes recommandés */
  recommendedCardTypes: CardType[];
}

/**
 * Paramètres pour la génération de cartes
 */
export interface CardGenerationParams {
  /** Thème/chapitre du programme */
  topic: string;
  /** Matière (mathematiques, francais, etc.) */
  subject: string;
  /** Niveau scolaire de l'élève */
  level: EducationLevelType;
  /** Contexte RAG (programme officiel) */
  ragContext: string;
  /** Nombre de cartes à générer */
  cardCount: number;
}

/**
 * Carte parsée depuis la réponse IA
 */
export interface ParsedCard {
  cardType: CardType;
  content: CardContent;
}
