/**
 * Learning Cards Repository - Data-access layer for learning_cards.
 *
 * One method = one typed Drizzle query. Transaction-aware: every write can
 * run on the ambient `db` or on a `PgTransaction` handle provided by the
 * service layer.
 */

import { asc, eq } from 'drizzle-orm';
import { db } from '../connection';
import {
  learningCards,
  type LearningCard,
  type NewLearningCard,
} from '../schema';
import type { PgTransaction } from 'drizzle-orm/pg-core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = typeof db | PgTransaction<any, any, any>;

export class LearningCardsRepository {
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
   * Delete every card attached to a deck. Normally not needed because the
   * FK cascade handles this when the deck itself is deleted, but exposed for
   * "empty the deck without deleting it" flows (card-generate retries, etc.).
   */
  async deleteByDeckId(deckId: string, executor: DbOrTx = db): Promise<void> {
    await executor.delete(learningCards).where(eq(learningCards.deckId, deckId));
  }
}

export const learningCardsRepository = new LearningCardsRepository();
