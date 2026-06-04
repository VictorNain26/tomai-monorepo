/**
 * Learning Cards Repository - Data-access layer for learning_cards.
 *
 * One method = one typed Drizzle query. Transaction-aware: every write can
 * run on the ambient `db` or on a `PgTransaction` handle provided by the
 * service layer.
 */

import { asc, eq, and, sql } from 'drizzle-orm';
import { db } from '../connection';
import {
  learningCards,
  learningDecks,
  type LearningCard,
  type NewLearningCard,
} from '../schema';
import type { PgTransaction } from 'drizzle-orm/pg-core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = typeof db | PgTransaction<any, any, any>;

export class LearningCardsRepository {
  /**
   * Fetch a card by id, verifying ownership via the deck it belongs to.
   * Returns the card and deck user id on match; null if card missing or
   * user does not own the deck.
   */
  async findByIdWithOwner(
    cardId: string,
    userId: string,
  ): Promise<{ card: LearningCard; deckUserId: string } | null> {
    const [result] = await db
      .select({
        card: learningCards,
        deckUserId: learningDecks.userId,
      })
      .from(learningCards)
      .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
      .where(
        and(
          eq(learningCards.id, cardId),
          eq(learningDecks.userId, userId),
        ),
      )
      .limit(1);

    return result ?? null;
  }

  /**
   * List all cards attached to a deck, ordered by `position`.
   */
  async listByDeck(deckId: string): Promise<LearningCard[]> {
    return db
      .select()
      .from(learningCards)
      .where(eq(learningCards.deckId, deckId))
      .orderBy(asc(learningCards.position));
  }

  /**
   * Bulk-insert cards. Returns [] when `cards` is empty (no-op, avoids the
   * Drizzle "empty VALUES ()" SQL error).
   */
  async insertMany(
    cards: NewLearningCard[],
    executor: DbOrTx = db,
  ): Promise<LearningCard[]> {
    if (cards.length === 0) return [];

    return executor.insert(learningCards).values(cards).returning();
  }

  /**
   * Update a card by id. Returns null if no row matched.
   */
  async updateById(
    cardId: string,
    patch: Partial<NewLearningCard>,
    executor: DbOrTx = db,
  ): Promise<LearningCard | null> {
    const [updated] = await executor
      .update(learningCards)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(learningCards.id, cardId))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete a card by id. Returns the deleted card or null if no row matched.
   */
  async deleteById(
    cardId: string,
    executor: DbOrTx = db,
  ): Promise<LearningCard | null> {
    const [deleted] = await executor
      .delete(learningCards)
      .where(eq(learningCards.id, cardId))
      .returning();

    return deleted ?? null;
  }

  /**
   * Delete every card attached to a deck. Normally not needed because the
   * FK cascade handles this when the deck itself is deleted, but exposed for
   * "empty the deck without deleting it" flows (card-generate retries, etc.).
   */
  async deleteByDeckId(deckId: string, executor: DbOrTx = db): Promise<void> {
    await executor.delete(learningCards).where(eq(learningCards.deckId, deckId));
  }

  /**
   * Count cards in a deck. Used after deletion to recalculate cardCount.
   */
  async countByDeckId(deckId: string, executor: DbOrTx = db): Promise<number> {
    const [result] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(learningCards)
      .where(eq(learningCards.deckId, deckId));

    return result?.count ?? 0;
  }

  /**
   * Count due cards across all decks owned by `userId`.
   * "Due" means the FSRS due timestamp is at or before NOW().
   */
  async countDueByUser(userId: string, executor: DbOrTx = db): Promise<number> {
    const [result] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(learningCards)
      .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
      .where(
        and(
          eq(learningDecks.userId, userId),
          sql`(${learningCards.fsrsData}->>'due')::timestamptz <= NOW()`,
        ),
      );

    return result?.count ?? 0;
  }
}

export const learningCardsRepository = new LearningCardsRepository();
