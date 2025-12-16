/**
 * Learning Routes - FSRS Review System
 *
 * Spaced repetition endpoints using FSRS algorithm.
 * Handles card reviews, due cards, statistics, and scheduling preview.
 */

import { Elysia, t } from 'elysia';
import { db } from '../../db/connection';
import { learningDecks, learningCards } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { handleAuthWithCookies } from '../../middleware/auth.middleware';
import { logger } from '../../lib/observability';
import { fsrsService, Rating } from '../../services/fsrs.service';
import { getLevelConfig } from '../../config/learning-config';
import { getUserLevel } from './helpers';

export const fsrsRoutes = new Elysia({ prefix: '/api/learning' })

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
    async ({ request, body, set }) => {
      const authContext = await handleAuthWithCookies(request.headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const { user: authUser } = authContext;
      const { cardId, rating } = body;

      const level = getUserLevel(authUser.id, authUser.schoolLevel);

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

        if (!card || card.deckUserId !== authUser.id) {
          set.status = 404;
          return { error: 'Carte non trouvée' };
        }

        // Record review with FSRS
        const result = await fsrsService.reviewCard(cardId, rating as Rating, level);

        logger.info('Card reviewed via API', {
          operation: 'learning:review',
          userId: authUser.id,
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
          userId: authUser.id,
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
    async ({ request, params, query, set }) => {
      const authContext = await handleAuthWithCookies(request.headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const { user: authUser } = authContext;
      const { id: deckId } = params;
      const level = getUserLevel(authUser.id, authUser.schoolLevel);

      // Parameters with level-adapted defaults
      const config = getLevelConfig(level);
      const limit = query.limit ? parseInt(query.limit, 10) : config.cardsPerSession;
      const includeNew = query.includeNew !== 'false';

      try {
        const dueCards = await fsrsService.getDueCards({
          deckId,
          userId: authUser.id,
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
          userId: authUser.id,
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
  .get('/decks/:id/stats', async ({ request, params, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { id: deckId } = params;

    try {
      const stats = await fsrsService.getDeckStats(deckId, authUser.id);

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
        userId: authUser.id,
        deckId,
        _error: errorMessage,
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Échec de la récupération des statistiques' };
    }
  })

  /**
   * Preview FSRS scheduling for a card
   * GET /api/learning/cards/:id/preview
   *
   * Useful for displaying intervals before answering
   */
  .get('/cards/:id/preview', async ({ request, params, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { id: cardId } = params;
    const level = getUserLevel(authUser.id, authUser.schoolLevel);

    try {
      // Verify ownership
      const [card] = await db
        .select({
          card: learningCards,
          deckUserId: learningDecks.userId,
        })
        .from(learningCards)
        .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
        .where(eq(learningCards.id, cardId))
        .limit(1);

      if (!card || card.deckUserId !== authUser.id) {
        set.status = 404;
        return { error: 'Carte non trouvée' };
      }

      const fsrsData = card.card.fsrsData as Record<string, unknown> | null;
      const preview = fsrsService.previewScheduling(level, fsrsData);

      // Format for frontend
      const formatPreview = (grade: 1 | 2 | 3 | 4) => {
        const data = preview[grade];
        return {
          nextReview: data.due.toISOString(),
          intervalDays: data.interval,
          message: data.interval === 0
            ? 'Maintenant'
            : data.interval < 1
              ? `Dans ${Math.round(data.interval * 24 * 60)} minutes`
              : `Dans ${data.interval} jour${data.interval > 1 ? 's' : ''}`,
        };
      };

      return {
        cardId,
        scheduling: {
          again: formatPreview(1),
          hard: formatPreview(2),
          good: formatPreview(3),
          easy: formatPreview(4),
        },
      };
    } catch (error) {
      logger.error('Failed to preview scheduling', {
        operation: 'learning:preview:error',
        userId: authUser.id,
        cardId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'low' as const,
      });
      set.status = 500;
      return { error: 'Échec de la prévisualisation' };
    }
  })

  /**
   * Reset FSRS data for a deck (reset all cards to new)
   * POST /api/learning/decks/:id/reset
   *
   * Useful for restarting learning from scratch
   */
  .post('/decks/:id/reset', async ({ request, params, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { id: deckId } = params;

    try {
      const cardsReset = await fsrsService.resetDeck(deckId, authUser.id);

      logger.info('Deck FSRS reset', {
        operation: 'learning:reset',
        userId: authUser.id,
        deckId,
        cardsReset,
      });

      return {
        success: true,
        cardsReset,
        message: `${cardsReset} carte${cardsReset > 1 ? 's' : ''} remise${cardsReset > 1 ? 's' : ''} à zéro`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
        set.status = 404;
        return { error: 'Deck non trouvé' };
      }

      logger.error('Failed to reset deck', {
        operation: 'learning:reset:error',
        userId: authUser.id,
        deckId,
        _error: errorMessage,
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Échec de la réinitialisation' };
    }
  })

  /**
   * Get learning configuration for user's level
   * GET /api/learning/config
   *
   * Useful for frontend to adapt UI
   */
  .get('/config', async ({ request, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const level = getUserLevel(authUser.id, authUser.schoolLevel);
    const config = getLevelConfig(level);

    return {
      level,
      config: {
        cardsPerSession: config.cardsPerSession,
        sessionMinutes: config.sessionMinutes,
        cycle: config.cycle,
        ageRange: config.ageRange,
      },
      ui: {
        showTimer: config.sessionMinutes <= 20,
        encourageBreaks: config.cycle === 'cycle2',
        maxNewCardsPerSession: Math.ceil(config.cardsPerSession * 0.3),
      },
    };
  });
