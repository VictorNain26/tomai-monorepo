/**
 * Learning Routes - FSRS Review System
 *
 * Spaced repetition endpoints using FSRS algorithm.
 * Handles card reviews, due cards, and statistics.
 * Preview, reset, and config endpoints are in fsrs-extra.routes.ts.
 */

import { Elysia, t } from 'elysia';
import { db } from '../../db/connection';
import { learningDecks, learningCards } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { authMacro } from '../../lib/auth-macro';
import { logger } from '../../lib/observability';
import { fsrsService, Rating } from '../../services/fsrs.service';
import { getLevelConfig } from '../../config/learning-config';
import { getUserLevel } from './helpers';

export const fsrsRoutes = new Elysia({ prefix: '/api/learning' })
  .use(authMacro)
  .guard({ auth: true })

  /**
   * Get total due cards count for the authenticated user
   * GET /api/learning/due-summary
   */
  .get('/due-summary', async ({ user, set }) => {
    try {
      const userId = user.id;

      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(learningCards)
        .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
        .where(
          and(
            eq(learningDecks.userId, userId),
            sql`(${learningCards.fsrsData}->>'due')::timestamptz <= NOW()`
          )
        );

      const totalDue = result[0]?.count ?? 0;

      return { success: true, totalDue };
    } catch (error) {
      logger.error('Failed to fetch due summary', {
        operation: 'learning:due-summary:error',
        userId: user.id,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch due summary' };
    }
  })

  /**
   * Record a card review with FSRS
   * POST /api/learning/review
   *
   * Rating corresponds to perceived difficulty:
   * - 1 (Again): I didn't know / Review immediately
   * - 2 (Hard): Difficult / Struggled
   * - 3 (Good): Correct / Good answer with effort
   * - 4 (Easy): Easy / Immediate answer
   */
  .post(
    '/review',
    async ({ body, user, set }) => {
      const { cardId, rating } = body;

      const level = getUserLevel(user.id, user.schoolLevel);

      try {
        // Verify card belongs to user
        const [card] = await db
          .select({
            card: learningCards,
            deckUserId: learningDecks.userId,
          })
          .from(learningCards)
          .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
          .where(eq(learningCards.id, cardId))
          .limit(1);

        if (!card || card.deckUserId !== user.id) {
          set.status = 404;
          return { error: 'Carte non trouvée' };
        }

        // Record review with FSRS
        const result = await fsrsService.reviewCard(cardId, rating as Rating, level);

        logger.info('Card reviewed via API', {
          operation: 'learning:review',
          userId: user.id,
          cardId,
          rating,
          newState: result.newState,
          nextDue: result.nextDue.toISOString(),
        });

        return {
          success: true,
          result: {
            cardId: result.cardId,
            rating: result.rating,
            previousState: result.previousState,
            newState: result.newState,
            nextDue: result.nextDue.toISOString(),
            stability: Math.round(result.stability * 100) / 100,
            difficulty: Math.round(result.difficulty * 100) / 100,
            reps: result.reps,
            lapses: result.lapses,
          },
        };
      } catch (error) {
        logger.error('Failed to review card', {
          operation: 'learning:review:error',
          userId: user.id,
          cardId,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'medium' as const,
        });
        set.status = 500;
        return { error: 'Échec de l\'enregistrement de la révision' };
      }
    },
    {
      body: t.Object({
        cardId: t.String({ format: 'uuid' }),
        rating: t.Number({ minimum: 1, maximum: 4 }),
      }),
    }
  )

  /**
   * Get due cards for review
   * GET /api/learning/decks/:id/due
   *
   * Returns cards sorted by urgency:
   * 1. Overdue cards
   * 2. Learning/relearning cards
   * 3. Review cards
   * 4. New cards (if includeNew=true)
   */
  .get(
    '/decks/:id/due',
    async ({ params, query, user, set }) => {
      const { id: deckId } = params;
      const level = getUserLevel(user.id, user.schoolLevel);

      // Parameters with level-adapted defaults
      const config = getLevelConfig(level);
      const limit = query.limit ? parseInt(query.limit, 10) : config.cardsPerSession;
      const includeNew = query.includeNew !== 'false';

      try {
        const dueCards = await fsrsService.getDueCards({
          deckId,
          userId: user.id,
          limit,
          includeNew,
        });

        return {
          cards: dueCards.map((card) => ({
            id: card.id,
            deckId: card.deckId,
            cardType: card.cardType,
            content: card.content,
            position: card.position,
            overdue: card.overdue,
            // Don't return fsrsData to frontend (invisible to student)
          })),
          count: dueCards.length,
          overdueCount: dueCards.filter((c) => c.overdue).length,
          sessionConfig: {
            recommendedCards: config.cardsPerSession,
            sessionMinutes: config.sessionMinutes,
            level,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
          set.status = 404;
          return { error: 'Deck non trouvé' };
        }

        logger.error('Failed to get due cards', {
          operation: 'learning:due:error',
          userId: user.id,
          deckId,
          _error: errorMessage,
          severity: 'medium' as const,
        });
        set.status = 500;
        return { error: 'Échec de la récupération des cartes' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        includeNew: t.Optional(t.String()),
      }),
    }
  )

  /**
   * Get deck review statistics
   * GET /api/learning/decks/:id/stats
   *
   * Stats invisible to student but useful for:
   * - Debugging / support
   * - Parent dashboard (future)
   */
  .get('/decks/:id/stats', async ({ params, user, set }) => {
    const { id: deckId } = params;

    try {
      const stats = await fsrsService.getDeckStats(deckId, user.id);

      return {
        stats: {
          ...stats,
          averageDifficulty: Math.round(stats.averageDifficulty * 100) / 100,
          averageStability: Math.round(stats.averageStability * 100) / 100,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
        set.status = 404;
        return { error: 'Deck non trouvé' };
      }

      logger.error('Failed to get deck stats', {
        operation: 'learning:stats:error',
        userId: user.id,
        deckId,
        _error: errorMessage,
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Échec de la récupération des statistiques' };
    }
  });
