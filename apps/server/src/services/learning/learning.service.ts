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
  NewLearningCard,
  FSRSData,
} from '../../db/schema.js';
import { logger } from '../../lib/observability.js';
import { fsrsService, Rating } from '../fsrs.service.js';
import type { ReviewResult } from '../fsrs-types.js';
import type { EducationLevelType } from '../../types/index.js';
import {
  DeckNotFoundError,
  DeckOwnershipError,
  CardNotFoundError,
  CardValidationError,
} from './learning-errors.js';
import { validateCardContent } from './card-validation.js';

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

export interface AddCardsInput {
  cards: Array<{
    cardType: CardType;
    content: unknown;
    position?: number;
  }>;
  startPosition?: number;
}

export interface UpdateCardInput {
  cardType?: CardType;
  content?: unknown;
  position?: number;
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

  /**
   * Atomically add cards to a deck and update `cardCount`.
   * Throws ownership errors (DeckNotFoundError / DeckOwnershipError).
   * Single transaction ensures `cardCount` stays in sync with actual card count.
   */
  async addCardsToDeckOrThrow(
    userId: string,
    deckId: string,
    input: AddCardsInput,
  ): Promise<LearningCard[]> {
    const existing = await learningDecksRepository.findById(deckId);
    if (!existing) {
      throw new DeckNotFoundError(deckId);
    }
    if (existing.userId !== userId) {
      throw new DeckOwnershipError(userId, deckId);
    }

    input.cards.forEach((card, index) => {
      const validation = validateCardContent(
        card.cardType,
        card.content as Record<string, unknown>,
      );
      if (!validation.valid) {
        throw new CardValidationError(`Card ${index}: ${validation.error}`);
      }
    });

    return db.transaction(async (tx) => {
      // Derive positions and the new cardCount from the live row count *inside*
      // the transaction, not from the `existing.cardCount` snapshot read before
      // the tx — otherwise two concurrent adds compute the same base and the
      // counter (and positions) drift. Mirrors `deleteCardOrThrow`.
      const startPosition = input.startPosition ?? (await learningCardsRepository.countByDeckId(deckId, tx));
      const cardsToInsert: NewLearningCard[] = input.cards.map((card, index) => ({
        deckId,
        cardType: card.cardType,
        content: card.content,
        position: card.position ?? startPosition + index,
        fsrsData: fsrsService.initializeCardFsrsData(),
      }));

      const insertedCards = await learningCardsRepository.insertMany(
        cardsToInsert,
        tx,
      );

      if (insertedCards.length === 0) {
        throw new Error('Failed to insert cards');
      }

      const newCount = await learningCardsRepository.countByDeckId(deckId, tx);
      await learningDecksRepository.updateById(deckId, { cardCount: newCount }, tx);

      return insertedCards;
    });
  }

  /**
   * Update a card's content/position, scoped to the user via ownership check.
   * Throws CardNotFoundError (missing or not owned) or CardValidationError
   * (content invalid for its type).
   */
  async updateCardOrThrow(
    userId: string,
    cardId: string,
    patch: UpdateCardInput,
  ): Promise<LearningCard> {
    const existing = await learningCardsRepository.findByIdWithOwner(cardId, userId);
    if (!existing) {
      // Either card is missing or user doesn't own the deck.
      // We cannot distinguish without a second query, so treat both as "not found"
      // from the route's perspective (404).
      throw new CardNotFoundError(cardId);
    }

    if (patch.content !== undefined) {
      // Validate against the effective type: `cardType` in the patch acts as a
      // validation hint when provided, otherwise the card's current type.
      const effectiveType = patch.cardType ?? existing.card.cardType;
      const validation = validateCardContent(
        effectiveType,
        patch.content as Record<string, unknown>,
      );
      if (!validation.valid) {
        throw new CardValidationError(validation.error ?? 'Invalid card content');
      }
    }

    // Persist content/position only — a card's `cardType` is immutable here;
    // changing it would require re-validating the existing content too. Build
    // the patch from defined fields only, so an empty patch is a no-op rather
    // than relying on the ORM silently dropping `undefined` columns.
    const fields: Partial<NewLearningCard> = {};
    if (patch.content !== undefined) fields.content = patch.content;
    if (patch.position !== undefined) fields.position = patch.position;

    const updated = await learningCardsRepository.updateById(cardId, fields);
    if (!updated) {
      // Race condition (concurrent delete) — treat as not found.
      throw new CardNotFoundError(cardId);
    }

    return updated;
  }

  /**
   * Count all cards due for review across every deck owned by `userId`.
   * Used for the summary badge shown in the app header.
   */
  async getDueSummaryForUser(userId: string): Promise<number> {
    return learningCardsRepository.countDueByUser(userId);
  }

  /**
   * Verify card ownership, then record a FSRS review.
   * Throws CardNotFoundError when the card is absent or not owned by `userId`.
   */
  async reviewCardOrThrow(
    userId: string,
    cardId: string,
    rating: Rating,
    level: EducationLevelType,
  ): Promise<ReviewResult> {
    const existing = await learningCardsRepository.findByIdWithOwner(cardId, userId);
    if (!existing) {
      throw new CardNotFoundError(cardId);
    }
    return fsrsService.reviewCard(cardId, rating, level);
  }

  /**
   * Verify card ownership, then preview what each rating would schedule.
   * Throws CardNotFoundError when the card is absent or not owned by `userId`.
   */
  async previewCardOrThrow(
    userId: string,
    cardId: string,
    level: EducationLevelType,
  ): Promise<ReturnType<typeof fsrsService.previewScheduling>> {
    const existing = await learningCardsRepository.findByIdWithOwner(cardId, userId);
    if (!existing) {
      throw new CardNotFoundError(cardId);
    }
    return fsrsService.previewScheduling(level, existing.card.fsrsData as FSRSData | null);
  }

  /**
   * Delete a card and atomically recalculate the deck's `cardCount`.
   * Throws CardNotFoundError (missing or not owned).
   */
  async deleteCardOrThrow(userId: string, cardId: string): Promise<void> {
    const existing = await learningCardsRepository.findByIdWithOwner(cardId, userId);
    if (!existing) {
      throw new CardNotFoundError(cardId);
    }

    const deckId = existing.card.deckId;

    await db.transaction(async (tx) => {
      // Delete the specific card
      const deleted = await learningCardsRepository.deleteById(cardId, tx);
      if (!deleted) {
        throw new Error('Failed to delete card');
      }

      // Recount cards in the deck and update `cardCount`
      const newCount = await learningCardsRepository.countByDeckId(deckId, tx);

      await learningDecksRepository.updateById(
        deckId,
        { cardCount: newCount },
        tx,
      );

      logger.info('Card deleted', {
        operation: 'learning:service:delete-card',
        userId,
        cardId,
        deckId,
      });
    });
  }
}

export const learningService = new LearningService();

// Re-export errors so route handlers can narrow without a second import.
export { DeckNotFoundError, DeckOwnershipError, CardNotFoundError, CardValidationError } from './learning-errors.js';
