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
   * and the Mistral tool-executor.
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
   * Fetch a deck (+ cards) scoped to the user. Throws on missing/unauthorized
   * so the route layer maps domain errors to HTTP in a single place.
   * Distinguishes between:
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
   * Throw-based deck update. Distinguishes between "deck missing" and "deck
   * owned by someone else" (same taxonomy as `getDeckWithCardsOrThrow`) so the
   * route layer can surface a consistent response shape without a second
   * ownership lookup.
   */
  async updateDeckOrThrow(
    userId: string,
    deckId: string,
    fields: UpdateDeckInput,
  ): Promise<LearningDeck> {
    const existing = await learningDecksRepository.findById(deckId);
    if (!existing) {
      throw new DeckNotFoundError(deckId);
    }
    if (existing.userId !== userId) {
      throw new DeckOwnershipError(userId, deckId);
    }

    const updated = await learningDecksRepository.updateById(deckId, fields);
    if (!updated) {
      // Should never happen because we just confirmed the row exists — treat
      // the concurrent-delete race as "not found" so the route returns 404.
      throw new DeckNotFoundError(deckId);
    }
    return updated;
  }

  /**
   * Throw-based deck deletion. Mirrors the error taxonomy of
   * `getDeckWithCardsOrThrow` / `updateDeckOrThrow`.
   * Cards are removed via the FK cascade on `learning_cards.deck_id`.
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
