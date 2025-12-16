/**
 * Learning Types - Outils de révision (13 types de cartes)
 */

import type { EducationLevelType } from './education.types';

// ======================================
// Learning Tools Types (13 card types by subject category)
// ======================================

/**
 * Card types for learning tools
 * - Universal: flashcard, qcm, vrai_faux (all subjects)
 * - Languages: matching, fill_blank, word_order
 * - Math/Sciences: calculation
 * - History-Geo: timeline, matching_era, cause_effect
 * - SVT: classification, process_order
 * - French: grammar_transform
 */
export type CardType =
  // Universal (all subjects)
  | 'flashcard'
  | 'qcm'
  | 'vrai_faux'
  // Languages (LV1, LV2)
  | 'matching'
  | 'fill_blank'
  | 'word_order'
  // Math/Sciences
  | 'calculation'
  // History-Geography
  | 'timeline'
  | 'matching_era'
  | 'cause_effect'
  // SVT/Sciences
  | 'classification'
  | 'process_order'
  // French
  | 'grammar_transform';

/**
 * Deck source - how the deck was created
 */
export type DeckSource = 'prompt' | 'conversation' | 'document' | 'rag_program';

// ======================================
// Universal Card Content Types
// ======================================

/**
 * Flashcard content structure
 */
export interface IFlashcardContent {
  front: string;
  back: string;
}

/**
 * QCM (multiple choice) content structure
 */
export interface IQCMContent {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

/**
 * Vrai/Faux (true/false) content structure
 */
export interface IVraiFauxContent {
  statement: string;
  isTrue: boolean;
  explanation?: string;
}

// ======================================
// Language Card Content Types
// ======================================

/**
 * Matching content structure (word-translation pairs)
 */
export interface IMatchingContent {
  instruction: string;
  pairs: Array<{ left: string; right: string }>;
}

/**
 * Fill blank content structure (fill in the blank)
 */
export interface IFillBlankContent {
  sentence: string;
  options: string[];
  correctIndex: number;
  grammaticalPoint?: string;
  explanation?: string;
}

/**
 * Word order content structure (reorder words)
 */
export interface IWordOrderContent {
  instruction: string;
  words: string[];
  correctSentence: string;
  translation?: string;
}

// ======================================
// Math/Science Card Content Types
// ======================================

/**
 * Calculation content structure (step-by-step problem solving)
 */
export interface ICalculationContent {
  problem: string;
  steps: string[];
  answer: string;
  hint?: string;
}

// ======================================
// History-Geography Card Content Types
// ======================================

/**
 * Timeline content structure (chronological ordering)
 */
export interface ITimelineContent {
  instruction: string;
  events: Array<{
    event: string;
    date: string;
    hint?: string;
  }>;
  correctOrder: number[];
}

/**
 * Matching era content structure (match items to eras)
 */
export interface IMatchingEraContent {
  instruction: string;
  items: string[];
  eras: string[];
  correctPairs: Array<[number, number]>; // [itemIndex, eraIndex]
}

/**
 * Cause effect content structure (identify consequences)
 */
export interface ICauseEffectContent {
  context: string;
  cause: string;
  possibleEffects: string[];
  correctIndex: number;
  explanation?: string;
}

// ======================================
// SVT/Science Card Content Types
// ======================================

/**
 * Classification content structure (categorize items)
 */
export interface IClassificationContent {
  instruction: string;
  items: string[];
  categories: string[];
  correctClassification: Record<string, number[]>; // category -> item indices
  explanation?: string;
}

/**
 * Process order content structure (order process steps)
 */
export interface IProcessOrderContent {
  instruction: string;
  processName: string;
  steps: string[];
  correctOrder: number[];
  explanation?: string;
}

// ======================================
// French Card Content Types
// ======================================

/**
 * Grammar transform content structure (grammatical transformations)
 */
export interface IGrammarTransformContent {
  instruction: string;
  originalSentence: string;
  transformationType: 'tense' | 'voice' | 'form' | 'number';
  correctAnswer: string;
  acceptableVariants?: string[];
  explanation?: string;
}

/**
 * Card content union type
 */
export type CardContent =
  // Universal
  | IFlashcardContent
  | IQCMContent
  | IVraiFauxContent
  // Languages
  | IMatchingContent
  | IFillBlankContent
  | IWordOrderContent
  // Math/Sciences
  | ICalculationContent
  // History-Geography
  | ITimelineContent
  | IMatchingEraContent
  | ICauseEffectContent
  // SVT/Sciences
  | IClassificationContent
  | IProcessOrderContent
  // French
  | IGrammarTransformContent;

// ======================================
// Learning Card & Deck Types
// ======================================

/**
 * Learning card structure
 */
export interface ILearningCard {
  id: string;
  deckId: string;
  cardType: CardType;
  content: CardContent;
  position: number;
  fsrsData?: Record<string, unknown>; // Hidden FSRS data for spaced repetition
  createdAt: string;
  updatedAt: string;
}

/**
 * Learning deck structure
 */
export interface ILearningDeck {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  subject: string;
  source: DeckSource;
  sourceId?: string | null;
  sourcePrompt?: string | null;
  schoolLevel?: EducationLevelType | null;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Deck with cards (for full deck view)
 */
export interface ILearningDeckWithCards extends ILearningDeck {
  cards: ILearningCard[];
}

// ======================================
// API Request/Response Types
// ======================================

/**
 * Create deck request
 */
export interface ICreateDeckRequest {
  title: string;
  description?: string;
  subject: string;
  source: DeckSource;
  sourceId?: string;
  sourcePrompt?: string;
  schoolLevel?: EducationLevelType;
}

/**
 * Create card request
 */
export interface ICreateCardRequest {
  cardType: CardType;
  content: CardContent;
  position?: number;
}

/**
 * API responses for learning tools
 */
export interface IDecksResponse {
  decks: ILearningDeck[];
  count: number;
}

export interface IDeckResponse {
  deck: ILearningDeck;
}

export interface IDeckWithCardsResponse {
  deck: ILearningDeck;
  cards: ILearningCard[];
}

export interface ICardsResponse {
  cards: ILearningCard[];
  count: number;
}

export interface ICardResponse {
  card: ILearningCard;
}

/**
 * Generate deck request (AI generation)
 * Note: schoolLevel n'est PAS envoyé - le backend utilise automatiquement
 * le niveau du profil utilisateur pour garantir l'alignement programme
 */
export interface IGenerateDeckRequest {
  subject: string;
  topic: string;
  cardCount?: number;
}

/**
 * Generate deck response (AI generation)
 */
export interface IGenerateDeckResponse {
  deck: ILearningDeck;
  cards: ILearningCard[];
  metadata: {
    ragStrategy: string;
    tokensUsed: number;
  };
}
