/**
 * @repo/api - Types pour les Query Factories
 *
 * Types spécifiques aux requêtes API.
 * Les types généraux sont dans @repo/shared-types.
 */

// ============================================================================
// EDUCATION TYPES
// ============================================================================

export type EducationLevelType =
  | 'primaire-cp'
  | 'primaire-ce1'
  | 'primaire-ce2'
  | 'primaire-cm1'
  | 'primaire-cm2'
  | 'college-6'
  | 'college-5'
  | 'college-4'
  | 'college-3'
  | 'lycee-2nde'
  | 'lycee-1ere'
  | 'lycee-tle';

export type Lv2Option =
  | 'allemand'
  | 'espagnol'
  | 'italien'
  | 'portugais'
  | 'chinois'
  | 'japonais'
  | 'russe'
  | 'arabe'
  | 'hebreu';

// ============================================================================
// PARENT/CHILD TYPES
// ============================================================================

export interface IChild {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel: EducationLevelType;
  dateOfBirth?: string;
  isActive: boolean;
  parentId: string;
  createdAt: string;
  selectedLv2?: Lv2Option | null;
}

export interface ICreateChildData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  schoolLevel: EducationLevelType;
  dateOfBirth?: string;
  selectedLv2?: Lv2Option;
}

export interface IDashboardStats {
  totalSessions: number;
  totalStudyTime: number;
  activeChildren: number;
  tokensUsed?: number;
  tokensLimit?: number;
}

// ============================================================================
// CHAT/SESSION TYPES
// ============================================================================

export interface IChatSession {
  id: string;
  subject: string;
  startedAt: string;
  endedAt?: string;
  messagesCount: number;
}

// ============================================================================
// LEARNING TYPES (Flashcards, QCM, etc.)
// ============================================================================

export type CardType =
  | 'flashcard'
  | 'qcm'
  | 'vrai_faux'
  | 'fill_blank'
  | 'matching'
  | 'classification'
  | 'timeline'
  | 'matching_era'
  | 'word_order'
  | 'cause_effect'
  | 'grammar_transform'
  | 'calculation'
  | 'process_order';

export interface ILearningDeck {
  id: string;
  userId: string;
  title: string;
  description?: string;
  subject: string;
  cardTypes: CardType[];
  cardsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ILearningCard {
  id: string;
  deckId: string;
  cardType: CardType;
  content: CardContent;
  position: number;
  fsrsData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type CardContent =
  | FlashcardContent
  | QcmContent
  | VraiFauxContent
  | FillBlankContent
  | MatchingContent
  | ClassificationContent
  | TimelineContent
  | MatchingEraContent
  | WordOrderContent
  | CauseEffectContent
  | GrammarTransformContent
  | CalculationContent
  | ProcessOrderContent;

export interface FlashcardContent {
  type: 'flashcard';
  question: string;
  answer: string;
}

export interface QcmContent {
  type: 'qcm';
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface VraiFauxContent {
  type: 'vrai_faux';
  statement: string;
  isTrue: boolean;
  explanation?: string;
}

export interface FillBlankContent {
  type: 'fill_blank';
  text: string;
  blanks: { position: number; answer: string }[];
}

export interface MatchingContent {
  type: 'matching';
  pairs: { left: string; right: string }[];
}

export interface ClassificationContent {
  type: 'classification';
  categories: { name: string; items: string[] }[];
}

export interface TimelineContent {
  type: 'timeline';
  events: { date: string; event: string }[];
}

export interface MatchingEraContent {
  type: 'matching_era';
  items: { event: string; era: string }[];
}

export interface WordOrderContent {
  type: 'word_order';
  correctOrder: string[];
  instruction?: string;
}

export interface CauseEffectContent {
  type: 'cause_effect';
  pairs: { cause: string; effect: string }[];
}

export interface GrammarTransformContent {
  type: 'grammar_transform';
  original: string;
  transformed: string;
  instruction: string;
}

export interface CalculationContent {
  type: 'calculation';
  problem: string;
  answer: number | string;
  steps?: string[];
}

export interface ProcessOrderContent {
  type: 'process_order';
  steps: string[];
  title?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface IDecksResponse {
  decks: ILearningDeck[];
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
}

export interface ICardResponse {
  card: ILearningCard;
}

export interface ICreateDeckRequest {
  title: string;
  description?: string;
  subject: string;
  cardTypes: CardType[];
}

export interface ICreateCardRequest {
  cardType: CardType;
  content: CardContent;
  position?: number;
}

export interface IGenerateDeckRequest {
  subject: string;
  niveau: EducationLevelType;
  topic?: string;
  cardTypes: CardType[];
  cardsCount: number;
}

export interface IGenerateDeckResponse {
  deck: ILearningDeck;
  cards: ILearningCard[];
}

// ============================================================================
// EDUCATION API TYPES
// ============================================================================

export interface IEducationSubject {
  key: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  ragKeywords: string[];
  ragAvailable: boolean;
}

export interface IEducationSubjectsResponse {
  success: boolean;
  subjects: IEducationSubject[];
  level: string;
  selectedLv2: Lv2Option | null;
  message?: string;
}

export interface IDomainWithTopics {
  domaine: string;
  themes: string[];
}

export interface ITopicsResponse {
  matiere: string;
  niveau: string;
  domaines: IDomainWithTopics[];
  totalTopics: number;
}
