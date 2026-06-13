import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card as FSRSCard,
  type RecordLog,
  type FSRSParameters,
  type Grade,
} from 'ts-fsrs';
import { learningCardsRepository } from '../db/repositories/learning-cards.repository.js';
import { learningDecksRepository } from '../db/repositories/learning-decks.repository.js';
import type { FSRSData } from '../db/schema.js';
import { getLevelConfig } from '../config/learning-config.js';
import type { EducationLevelType } from '../types/index.js';
import { logger } from '../lib/observability.js';

import type { ReviewResult, CardForReview, DeckReviewStats, GetDueCardsOptions } from './fsrs-types.js';

;

class FSRSService {
  private getScheduler(level: EducationLevelType): ReturnType<typeof fsrs> {
    const config = getLevelConfig(level);

    const params: Partial<FSRSParameters> = {
      request_retention: config.retention,
      maximum_interval: config.maxInterval,
      enable_short_term: true,
      enable_fuzz: true,
    };

    return fsrs(params);
  }

  private fsrsDataToCard(data: FSRSData | null | undefined): FSRSCard {
    if (!data || Object.keys(data).length === 0) {
      return createEmptyCard();
    }

    return {
      due: data.due ? new Date(data.due) : new Date(),
      stability: data.stability ?? 0,
      difficulty: data.difficulty ?? 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: data.reps ?? 0,
      lapses: data.lapses ?? 0,
      state: (data.state ?? State.New) as State,
      last_review: data.lastReview ? new Date(data.lastReview) : undefined,
    };
  }

  private cardToFsrsData(card: FSRSCard): FSRSData {
    return {
      due: card.due.toISOString(),
      stability: card.stability,
      difficulty: card.difficulty,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      lastReview: card.last_review?.toISOString(),
    };
  }

  async reviewCard(
    cardId: string,
    rating: Rating,
    level: EducationLevelType
  ): Promise<ReviewResult> {
    const scheduler = this.getScheduler(level);
    const now = new Date();

    const card = await learningCardsRepository.findById(cardId);

    if (!card) {
      throw new Error(`Card not found: ${cardId}`);
    }

    const currentCard = this.fsrsDataToCard(card.fsrsData as FSRSData);
    const previousState = currentCard.state;

    const recordLog: RecordLog = scheduler.repeat(currentCard, now);
    const newCard = recordLog[rating as Grade].card;
    const newFsrsData = this.cardToFsrsData(newCard);

    await learningCardsRepository.updateById(cardId, { fsrsData: newFsrsData });

    logger.info('Card reviewed', {
      cardId,
      rating,
      level,
      previousState,
      newState: newCard.state,
      nextDue: newCard.due.toISOString(),
      stability: newCard.stability,
      operation: 'fsrs-review',
    });

    return {
      cardId,
      rating,
      previousState,
      newState: newCard.state,
      nextDue: newCard.due,
      stability: newCard.stability,
      difficulty: newCard.difficulty,
      reps: newCard.reps,
      lapses: newCard.lapses,
    };
  }

  async getDueCards(options: GetDueCardsOptions): Promise<CardForReview[]> {
    const { deckId, userId, limit = 20, includeNew = true } = options;
    const now = new Date();

    const deck = await learningDecksRepository.findByUserAndId(deckId, userId);

    if (!deck) {
      throw new Error(`Deck not found or access denied: ${deckId}`);
    }

    const cards = await learningCardsRepository.listByDeck(deckId);

    const dueCards: CardForReview[] = [];

    for (const card of cards) {
      const fsrsData = card.fsrsData as FSRSData | null;
      const fsrsCard = this.fsrsDataToCard(fsrsData);

      if (fsrsCard.state === State.New) {
        if (includeNew) {
          dueCards.push({
            id: card.id,
            deckId: card.deckId,
            cardType: card.cardType,
            content: card.content,
            position: card.position,
            fsrsData: fsrsData ?? {},
            priority: 1000 + card.position,
            overdue: false,
          });
        }
        continue;
      }

      const dueDate = fsrsCard.due;
      const isDue = dueDate <= now;
      const isOverdue = dueDate < new Date(now.getTime() - 24 * 60 * 60 * 1000);

      if (isDue) {
        let priority: number;

        if (isOverdue) {
          const daysOverdue = Math.floor(
            (now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)
          );
          priority = -daysOverdue * 10;
        } else if (fsrsCard.state === State.Learning || fsrsCard.state === State.Relearning) {
          priority = 100;
        } else {
          priority = 500 + Math.floor(fsrsCard.stability);
        }

        dueCards.push({
          id: card.id,
          deckId: card.deckId,
          cardType: card.cardType,
          content: card.content,
          position: card.position,
          fsrsData: fsrsData ?? {},
          priority,
          overdue: isOverdue,
        });
      }
    }

    dueCards.sort((a, b) => a.priority - b.priority);

    return dueCards.slice(0, limit);
  }

  async getDeckStats(deckId: string, userId: string): Promise<DeckReviewStats> {
    const now = new Date();

    const deck = await learningDecksRepository.findByUserAndId(deckId, userId);

    if (!deck) {
      throw new Error(`Deck not found or access denied: ${deckId}`);
    }

    const cards = await learningCardsRepository.listByDeck(deckId);

    let newCards = 0;
    let learningCardsCount = 0;
    let reviewCards = 0;
    let relearningCards = 0;
    let dueToday = 0;
    let overdueCards = 0;
    let totalDifficulty = 0;
    let totalStability = 0;
    let cardsWithStats = 0;

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    for (const card of cards) {
      const fsrsData = card.fsrsData as FSRSData | null;
      const fsrsCard = this.fsrsDataToCard(fsrsData);

      switch (fsrsCard.state) {
        case State.New:
          newCards++;
          break;
        case State.Learning:
          learningCardsCount++;
          break;
        case State.Review:
          reviewCards++;
          break;
        case State.Relearning:
          relearningCards++;
          break;
      }

      if (fsrsCard.state !== State.New) {
        if (fsrsCard.due <= todayEnd) {
          dueToday++;
        }
        if (fsrsCard.due < now) {
          overdueCards++;
        }

        totalDifficulty += fsrsCard.difficulty;
        totalStability += fsrsCard.stability;
        cardsWithStats++;
      }
    }

    return {
      deckId,
      totalCards: cards.length,
      newCards,
      learningCards: learningCardsCount,
      reviewCards,
      relearningCards,
      dueToday,
      overdueCards,
      averageDifficulty: cardsWithStats > 0 ? totalDifficulty / cardsWithStats : 0,
      averageStability: cardsWithStats > 0 ? totalStability / cardsWithStats : 0,
    };
  }

  initializeCardFsrsData(): FSRSData {
    const emptyCard = createEmptyCard();
    return this.cardToFsrsData(emptyCard);
  }

  previewScheduling(
    level: EducationLevelType,
    currentFsrsData: FSRSData | null
  ): Record<Grade, { due: Date; interval: number }> {
    const scheduler = this.getScheduler(level);
    const currentCard = this.fsrsDataToCard(currentFsrsData);
    const now = new Date();

    const recordLog = scheduler.repeat(currentCard, now);

    return {
      [Rating.Again]: {
        due: recordLog[Rating.Again].card.due,
        interval: recordLog[Rating.Again].card.scheduled_days,
      },
      [Rating.Hard]: {
        due: recordLog[Rating.Hard].card.due,
        interval: recordLog[Rating.Hard].card.scheduled_days,
      },
      [Rating.Good]: {
        due: recordLog[Rating.Good].card.due,
        interval: recordLog[Rating.Good].card.scheduled_days,
      },
      [Rating.Easy]: {
        due: recordLog[Rating.Easy].card.due,
        interval: recordLog[Rating.Easy].card.scheduled_days,
      },
    } as Record<Grade, { due: Date; interval: number }>;
  }

  async resetCard(cardId: string): Promise<void> {
    const emptyFsrsData = this.initializeCardFsrsData();

    await learningCardsRepository.updateById(cardId, { fsrsData: emptyFsrsData });

    logger.info('Card FSRS data reset', {
      cardId,
      operation: 'fsrs-reset',
    });
  }

  async resetDeck(deckId: string, userId: string): Promise<number> {
    const deck = await learningDecksRepository.findByUserAndId(deckId, userId);

    if (!deck) {
      throw new Error(`Deck not found or access denied: ${deckId}`);
    }

    const emptyFsrsData = this.initializeCardFsrsData();

    await learningCardsRepository.resetFsrsDataByDeckId(deckId, emptyFsrsData);

    logger.info('Deck FSRS data reset', {
      deckId,
      operation: 'fsrs-reset-deck',
    });

    return deck.cardCount;
  }
}

export const fsrsService = new FSRSService();
export { Rating,  };
