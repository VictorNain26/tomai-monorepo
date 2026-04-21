/**
 * LearningService — data-access + transactional orchestration for decks/cards.
 *
 * Consolidates the deck+cards creation transaction previously duplicated in
 * card-generate.routes.ts and tool-executor.ts, and centralizes ownership
 * checks so route handlers stop hitting the DB directly.
 */

import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import {
  learningDecks,
  learningCards,
  type LearningDeck,
  type NewLearningDeck,
  type LearningCard,
  type CardType,
} from '../../db/schema.js';
import { logger } from '../../lib/observability.js';
import { fsrsService } from '../fsrs.service.js';

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
   * Atomic creation of a deck plus its cards. Used by:
   * - the manual generation endpoint (POST /api/learning/generate)
   * - the Gemini tool-executor when the chat asks to create flashcards
   *
   * Rolls back both inserts on any failure (previously the two sites had
   * their own separate, subtly different copies of this code).
   */
  async createDeckWithCards(
    input: CreateDeckWithCardsInput,
  ): Promise<{ deck: LearningDeck; cards: LearningCard[] }> {
    const { userId, deck: deckData, cards: cardsInput } = input;

    return db.transaction(async (tx) => {
      const [createdDeck] = await tx
        .insert(learningDecks)
        .values({
          ...deckData,
          userId,
          cardCount: cardsInput.length,
        })
        .returning();

      if (!createdDeck) {
        throw new Error('Failed to create deck');
      }

      const cardsToInsert = cardsInput.map((card, index) => ({
        deckId: createdDeck.id,
        cardType: card.cardType,
        content: card.content,
        position: index,
        fsrsData: fsrsService.initializeCardFsrsData(),
      }));

      const createdCards = cardsToInsert.length > 0
        ? await tx.insert(learningCards).values(cardsToInsert).returning()
        : [];

      if (cardsInput.length > 0 && createdCards.length === 0) {
        throw new Error('Failed to insert cards');
      }

      return { deck: createdDeck, cards: createdCards };
    });
  }

  /**
   * Fetch decks owned by the given user, most-recently-updated first.
   */
  async listUserDecks(userId: string): Promise<LearningDeck[]> {
    return db
      .select()
      .from(learningDecks)
      .where(eq(learningDecks.userId, userId))
      .orderBy(desc(learningDecks.updatedAt));
  }

  /**
   * Fetch one deck with its cards, scoped to the user (IDOR protection).
   * Returns null if the deck does not exist or belongs to someone else.
   */
  async getDeckWithCards(
    userId: string,
    deckId: string,
  ): Promise<{ deck: LearningDeck; cards: LearningCard[] } | null> {
    const [deck] = await db
      .select()
      .from(learningDecks)
      .where(and(eq(learningDecks.id, deckId), eq(learningDecks.userId, userId)))
      .limit(1);

    if (!deck) return null;

    const cards = await db
      .select()
      .from(learningCards)
      .where(eq(learningCards.deckId, deckId))
      .orderBy(asc(learningCards.position));

    return { deck, cards };
  }

  /**
   * Update a deck with a partial payload. Returns null if the deck does not
   * exist or is not owned by the caller.
   */
  async updateDeck(
    userId: string,
    deckId: string,
    fields: UpdateDeckInput,
  ): Promise<LearningDeck | null> {
    const [owned] = await db
      .select({ id: learningDecks.id })
      .from(learningDecks)
      .where(and(eq(learningDecks.id, deckId), eq(learningDecks.userId, userId)))
      .limit(1);

    if (!owned) return null;

    const [updated] = await db
      .update(learningDecks)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(learningDecks.id, deckId))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete a deck (cards cascade via the FK). Returns false if the deck
   * does not exist or does not belong to the user.
   */
  async deleteDeck(userId: string, deckId: string): Promise<boolean> {
    const [owned] = await db
      .select({ id: learningDecks.id })
      .from(learningDecks)
      .where(and(eq(learningDecks.id, deckId), eq(learningDecks.userId, userId)))
      .limit(1);

    if (!owned) return false;

    await db.delete(learningDecks).where(eq(learningDecks.id, deckId));

    logger.info('Deck deleted', {
      operation: 'learning:service:delete-deck',
      userId,
      deckId,
    });

    return true;
  }
}

export const learningService = new LearningService();
