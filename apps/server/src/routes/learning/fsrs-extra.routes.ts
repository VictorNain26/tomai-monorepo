/**
 * Learning Routes - FSRS Extra Endpoints
 *
 * Preview scheduling, deck reset, and learning config.
 */

import { Elysia } from 'elysia';
import { db } from '../../db/connection';
import { learningDecks, learningCards } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { handleAuthWithCookies } from '../../middleware/auth.middleware';
import { logger } from '../../lib/observability';
import { fsrsService } from '../../services/fsrs.service';
import { getLevelConfig } from '../../config/learning-config';
import { getUserLevel } from './helpers';

export const fsrsExtraRoutes = new Elysia({ prefix: '/api/learning' })

  .get('/cards/:id/preview', async ({ request, params, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { id: cardId } = params;
    const level = getUserLevel(authUser.id, authUser.schoolLevel);

    try {
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
