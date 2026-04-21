/**
 * LearningService - Domain service for decks & cards.
 *
 * Responsibilities:
 *  - Enforce ownership (IDOR protection) before any deck-scoped mutation
 *  - Orchestrate multi-table writes atomically via `db.transaction(...)`
 *  - Delegate every SQL call to the repository layer (no `db.insert/update/
 *    delete/select` in this file, except the transaction envelope itself)
 *
 * Consolidates the deck+cards creation transaction previously duplicated in
 * `card-generate.routes.ts` (transactional) and `chat/tool-executor.ts`
 * (non-transactional — the subtle bug this extraction fixes).
 */

import { db } from '../../db/connection.js';
import {
  learningDecksRepository,
  type ListDecksOptions,
} from '../../db/repositories/learning-decks.repository.js';
import { learningCardsRepository } from '../../db/repositories/learning-cards.repository.js';
import type {
  LearningDeck,
  NewLearningDeck,
  LearningCard,
  CardType,
} from '../../db/schema.js';
import { logger } from '../../lib/observability.js';
import { fsrsService } from '../fsrs.service.js';
import { DeckNotFoundError, DeckOwnershipError } from './learning-errors.js';

export interface CreateDeckWithCardsInput {
  userId: string;
  deck: Omit<NewLearningDeck, 'cardCount' | 'userId'>;
  cards: Array<{
    cardType: CardType;
    content: unknown;
  }>;
}

export interface UpdateDeckInput {
  title?: string;
  description?: string;
  subject?: string;
}

class LearningService {
  /**
   * Atomically create a deck and its cards in a single transaction.
   * Callers: `POST /api/learning/decks`, `POST /api/learning/generate`,
   * and the Gemini tool-executor.
   *
   * If the card insert fails, the deck insert is rolled back — previously
   * the tool-executor performed the two writes separately, leaving orphan
   * decks behind whenever cards failed to persist.
   */
  async createDeckWithCards(
    input: CreateDeckWithCardsInput,
  ): Promise<{ deck: LearningDeck; cards: LearningCard[] }> {
    const { userId, deck: deckData, cards: cardsInput } = input;

    return db.transaction(async (tx) => {
      const createdDeck = await learningDecksRepository.insert(
        { ...deckData, userId, cardCount: cardsInput.length },
        tx,
      );

      if (cardsInput.length === 0) {
        return { deck: createdDeck, cards: [] };
      }

      const cardsToInsert = cardsInput.map((card, index) => ({
        deckId: createdDeck.id,
        cardType: card.cardType,
        content: card.content,
        position: index,
        fsrsData: fsrsService.initializeCardFsrsData(),
      }));

      const createdCards = await learningCardsRepository.insertMany(
        cardsToInsert,
        tx,
      );

      if (createdCards.length === 0) {
        // Drizzle + postgres-js returns [] silently on some failure modes;
        // throwing here ensures the outer transaction rolls back the deck.
        throw new Error('Failed to insert cards');
      }

      return { deck: createdDeck, cards: createdCards };
    });
  }

  /**
   * List decks owned by the given user, most-recently-updated first.
   * Thin pass-through to the repository; kept on the service to preserve
   * the "routes talk to services, not repositories" convention.
   */
  async listUserDecks(
    userId: string,
    opts?: ListDecksOptions,
  ): Promise<LearningDeck[]> {
    return learningDecksRepository.listByUser(userId, opts);
  }

  /**
   * Fetch a deck (+ cards) scoped to the user.
   * Returns null if the deck does not exist or is not owned by the user.
   *
   * Kept return-null for backward compatibility with existing route handlers
   * that surface a 404. `getDeckWithCardsOrThrow` below is the throw-based
   * variant that routes will migrate to in phase 2.
   */
  async getDeckWithCards(
    userId: string,
    deckId: string,
  ): Promise<{ deck: LearningDeck; cards: LearningCard[] } | null> {
    const deck = await learningDecksRepository.findByUserAndId(userId, deckId);
    if (!deck) return null;

    const cards = await learningCardsRepository.listByDeck(deckId);
    return { deck, cards };
  }

  /**
   * Throw-based counterpart to `getDeckWithCards`. Distinguishes between:
   *   - deck missing entirely → DeckNotFoundError
   *   - deck exists but owned by another user → DeckOwnershipError
   */
  async getDeckWithCardsOrThrow(
    userId: string,
    deckId: string,
  ): Promise<{ deck: LearningDeck; cards: LearningCard[] }> {
    const existing = await learningDecksRepository.findById(deckId);
    if (!existing) {
      throw new DeckNotFoundError(deckId);
    }
    if (existing.userId !== userId) {
      throw new DeckOwnershipError(userId, deckId);
    }

    const cards = await learningCardsRepository.listByDeck(deckId);
    return { deck: existing, cards };
  }

  /**
   * Update a deck if the caller owns it. Returns null otherwise.
   */
  async updateDeck(
    userId: string,
    deckId: string,
    fields: UpdateDeckInput,
  ): Promise<LearningDeck | null> {
    const owned = await learningDecksRepository.findByUserAndId(userId, deckId);
    if (!owned) return null;

    return learningDecksRepository.updateById(deckId, fields);
  }

  /**
   * Delete a deck if the caller owns it (cards cascade via FK).
   * Returns false if the deck does not exist or is owned by someone else.
   */
  async deleteDeck(userId: string, deckId: string): Promise<boolean> {
    const owned = await learningDecksRepository.findByUserAndId(userId, deckId);
    if (!owned) return false;

    await learningDecksRepository.deleteById(deckId);

    logger.info('Deck deleted', {
      operation: 'learning:service:delete-deck',
      userId,
      deckId,
    });

    return true;
  }

  /**
   * Throw-based counterpart to `deleteDeck`. Mirrors the error taxonomy of
   * `getDeckWithCardsOrThrow`.
   */
  async deleteDeckOrThrow(userId: string, deckId: string): Promise<void> {
    const existing = await learningDecksRepository.findById(deckId);
    if (!existing) {
      throw new DeckNotFoundError(deckId);
    }
    if (existing.userId !== userId) {
      throw new DeckOwnershipError(userId, deckId);
    }

    await learningDecksRepository.deleteById(deckId);

    logger.info('Deck deleted', {
      operation: 'learning:service:delete-deck',
      userId,
      deckId,
    });
  }
}

export const learningService = new LearningService();

// Re-export errors so route handlers can narrow without a second import.
export { DeckNotFoundError, DeckOwnershipError } from './learning-errors.js';
