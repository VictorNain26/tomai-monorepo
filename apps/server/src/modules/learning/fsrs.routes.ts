/**
 * Learning Routes - FSRS Review System
 *
 * Spaced repetition endpoints using FSRS algorithm.
 * Handles card reviews, due cards, and statistics.
 * Preview, reset, and config endpoints are in fsrs-extra.routes.ts.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { validate, type AuthEnv } from '../../platform/http/context.js';
import { logger } from '../../platform/observability/logger';
import { learningService, CardNotFoundError } from './learning.service.js';
import { fsrsService, Rating } from './fsrs.service.js';
import { getLevelConfig } from './learning-config.js';
import { getUserLevel, idParam } from './routes.helpers.js';

const reviewBody = z.object({
  cardId: z.uuid(),
  rating: z.union([z.literal(Rating.Again), z.literal(Rating.Hard), z.literal(Rating.Good), z.literal(Rating.Easy)]),
});

const dueQuery = z.object({
  limit: z.string().optional(),
  includeNew: z.string().optional(),
});

export const fsrsRoutes = new Hono<AuthEnv>()

  /**
   * Get total due cards count for the authenticated user
   * GET /api/learning/due-summary
   */
  .get('/due-summary', async (c) => {
    const user = c.var.user;
    try {
      const totalDue = await learningService.getDueSummaryForUser(user.id);
      return c.json({ success: true, totalDue });
    } catch (error) {
      logger.error('Failed to fetch due summary', {
        operation: 'learning:due-summary:error',
        userId: user.id,
        err: error,
        severity: 'medium' as const,
      });
      return c.json({ error: 'Failed to fetch due summary' }, 500);
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
  .post('/review', validate('json', reviewBody), async (c) => {
    const user = c.var.user;
    const body = c.req.valid('json');
    const { cardId, rating } = body;
    const level = getUserLevel(user.id, user.schoolLevel);

    try {
      const result = await learningService.reviewCardOrThrow(user.id, cardId, rating, level);

      logger.info('Card reviewed via API', {
        operation: 'learning:review',
        userId: user.id,
        cardId,
        rating,
        newState: result.newState,
        nextDue: result.nextDue.toISOString(),
      });

      return c.json({
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
      });
    } catch (error) {
      if (error instanceof CardNotFoundError) {
        return c.json({ error: 'Carte non trouvée' }, 404);
      }
      logger.error('Failed to review card', {
        operation: 'learning:review:error',
        userId: user.id,
        cardId,
        err: error,
        severity: 'medium' as const,
      });
      return c.json({ error: "Échec de l'enregistrement de la révision" }, 500);
    }
  })

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
  .get('/decks/:id/due', validate('param', idParam), validate('query', dueQuery), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    const query = c.req.valid('query');
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

      return c.json({
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
        overdueCount: dueCards.filter((card) => card.overdue).length,
        sessionConfig: {
          recommendedCards: config.cardsPerSession,
          sessionMinutes: config.sessionMinutes,
          level,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
        return c.json({ error: 'Deck non trouvé' }, 404);
      }

      logger.error('Failed to get due cards', {
        operation: 'learning:due:error',
        userId: user.id,
        deckId,
        err: error,
        severity: 'medium' as const,
      });
      return c.json({ error: 'Échec de la récupération des cartes' }, 500);
    }
  })

  /**
   * Get deck review statistics
   * GET /api/learning/decks/:id/stats
   *
   * Stats invisible to student but useful for:
   * - Debugging / support
   * - Parent dashboard (future)
   */
  .get('/decks/:id/stats', validate('param', idParam), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    const { id: deckId } = params;

    try {
      const stats = await fsrsService.getDeckStats(deckId, user.id);

      return c.json({
        stats: {
          ...stats,
          averageDifficulty: Math.round(stats.averageDifficulty * 100) / 100,
          averageStability: Math.round(stats.averageStability * 100) / 100,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
        return c.json({ error: 'Deck non trouvé' }, 404);
      }

      logger.error('Failed to get deck stats', {
        operation: 'learning:stats:error',
        userId: user.id,
        deckId,
        err: error,
        severity: 'medium' as const,
      });
      return c.json({ error: 'Échec de la récupération des statistiques' }, 500);
    }
  });
