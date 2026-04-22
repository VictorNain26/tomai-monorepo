/**
 * Learning Decks Repository - Data-access layer for learning_decks.
 *
 * One method = one typed Drizzle query. No business logic here: ownership
 * checks, transactions and multi-step orchestration live in LearningService.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../connection';
import {
  learningDecks,
  type LearningDeck,
  type NewLearningDeck,
} from '../schema';
import type { PgTransaction } from 'drizzle-orm/pg-core';

/**
 * Drizzle database or transaction — accepted by every write method so the
 * service can reuse repository inserts inside `db.transaction(async (tx) => ...)`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = typeof db | PgTransaction<any, any, any>;

export interface ListDecksOptions {
  limit?: number;
  offset?: number;
}

export class LearningDecksRepository {
  /**
   * List decks owned by a user, most-recently-updated first.
   */
  async listByUser(
    userId: string,
    opts: ListDecksOptions = {},
  ): Promise<LearningDeck[]> {
    const query = db
      .select()
      .from(learningDecks)
      .where(eq(learningDecks.userId, userId))
      .orderBy(desc(learningDecks.updatedAt));

    if (opts.limit !== undefined && opts.offset !== undefined) {
      return query.limit(opts.limit).offset(opts.offset);
    }
    if (opts.limit !== undefined) {
      return query.limit(opts.limit);
    }
    if (opts.offset !== undefined) {
      return query.offset(opts.offset);
    }
    return query;
  }

  /**
   * Fetch a deck by id without any ownership check.
   * Callers (LearningService) are responsible for enforcing ownership.
   */
  async findById(deckId: string): Promise<LearningDeck | null> {
    const [deck] = await db
      .select()
      .from(learningDecks)
      .where(eq(learningDecks.id, deckId))
      .limit(1);

    return deck ?? null;
  }

  /**
   * Fetch a deck only if it belongs to the given user.
   * Returns null if the deck does not exist or is owned by someone else.
   * Single round-trip combined check (IDOR-safe).
   */
  async findByUserAndId(
    userId: string,
    deckId: string,
  ): Promise<LearningDeck | null> {
    const [deck] = await db
      .select()
      .from(learningDecks)
      .where(
        and(eq(learningDecks.id, deckId), eq(learningDecks.userId, userId)),
      )
      .limit(1);

    return deck ?? null;
  }

  /**
   * Insert a deck and return the created row.
   * Accepts an optional transaction handle so multi-table writes can be
   * performed atomically by the service layer.
   */
  async insert(data: NewLearningDeck, executor: DbOrTx = db): Promise<LearningDeck> {
    const [created] = await executor
      .insert(learningDecks)
      .values(data)
      .returning();

    if (!created) {
      throw new Error('Failed to insert deck');
    }

    return created;
  }

  /**
   * Update an existing deck by id. Ownership is checked upstream by the
   * service; repositories intentionally perform no auth logic.
   */
  async updateById(
    deckId: string,
    patch: Partial<NewLearningDeck>,
    executor: DbOrTx = db,
  ): Promise<LearningDeck | null> {
    const [updated] = await executor
      .update(learningDecks)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(learningDecks.id, deckId))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete a deck by id. Cards are removed by the `ON DELETE CASCADE` FK on
   * `learning_cards.deck_id`, so we do not need a separate card cleanup.
   */
  async deleteById(deckId: string, executor: DbOrTx = db): Promise<void> {
    await executor.delete(learningDecks).where(eq(learningDecks.id, deckId));
  }
}

export const learningDecksRepository = new LearningDecksRepository();
