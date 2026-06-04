/**
 * Learning Routes - FSRS Extra Endpoints
 *
 * Preview scheduling, deck reset, and learning config.
 */

import { Elysia } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { logger } from '../../lib/observability';
import { learningService, CardNotFoundError } from '../../services/learning/learning.service';
import { fsrsService } from '../../services/fsrs.service';
import { getLevelConfig } from '../../config/learning-config';
import { getUserLevel } from './helpers';

export const fsrsExtraRoutes = new Elysia({ prefix: '/api/learning' })
  .use(authMacro)
  .guard({ auth: true })

  .get('/cards/:id/preview', async ({ params, user, status }) => {
    const { id: cardId } = params;
    const level = getUserLevel(user.id, user.schoolLevel);

    try {
      const preview = await learningService.previewCardOrThrow(user.id, cardId, level);

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
      if (error instanceof CardNotFoundError) {
        return status(404, { error: 'Carte non trouvée' });
      }
      logger.error('Failed to preview scheduling', {
        operation: 'learning:preview:error',
        userId: user.id,
        cardId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'low' as const,
      });
      return status(500, { error: 'Échec de la prévisualisation' });
    }
  })

  .post('/decks/:id/reset', async ({ params, user, status }) => {
    const { id: deckId } = params;

    try {
      const cardsReset = await fsrsService.resetDeck(deckId, user.id);

      logger.info('Deck FSRS reset', {
        operation: 'learning:reset',
        userId: user.id,
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
        return status(404, { error: 'Deck non trouvé' });
      }

      logger.error('Failed to reset deck', {
        operation: 'learning:reset:error',
        userId: user.id,
        deckId,
        _error: errorMessage,
        severity: 'medium' as const,
      });
      return status(500, { error: 'Échec de la réinitialisation' });
    }
  })

  .get('/config', async ({ user }) => {
    const level = getUserLevel(user.id, user.schoolLevel);
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
