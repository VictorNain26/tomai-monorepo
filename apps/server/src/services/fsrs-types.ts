import type { Rating, State } from 'ts-fsrs';
import type { FSRSData, CardType } from '../db/schema.js';

export interface ReviewResult {
  cardId: string;
  rating: Rating;
  previousState: State;
  newState: State;
  nextDue: Date;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
}

export interface CardForReview {
  id: string;
  deckId: string;
  cardType: CardType;
  content: unknown;
  position: number;
  fsrsData: FSRSData;
  priority: number;
  overdue: boolean;
}

export interface DeckReviewStats {
  deckId: string;
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  relearningCards: number;
  dueToday: number;
  overdueCards: number;
  averageDifficulty: number;
  averageStability: number;
}

export interface GetDueCardsOptions {
  deckId: string;
  userId: string;
  limit?: number;
  includeNew?: boolean;
}
