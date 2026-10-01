/**
 * Learning Routes - FSRS Extra Endpoints
 *
 * Preview scheduling, deck reset, and learning config.
 */

import { Hono } from 'hono';
import { validate, type AuthEnv } from '../../platform/http/context.js';
import { logger } from '../../platform/observability/logger';
import { learningService, CardNotFoundError } from '../../services/learning/learning.service';
import { fsrsService } from '../../services/fsrs.service';
import { getLevelConfig } from '../../config/learning-config';
import { getUserLevel, idParam } from './helpers';

export const fsrsExtraRoutes = new Hono<AuthEnv>()

  .get('/cards/:id/preview', validate('param', idParam), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
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

      return c.json({
        cardId,
        scheduling: {
          again: formatPreview(1),
          hard: formatPreview(2),
          good: formatPreview(3),
          easy: formatPreview(4),
        },
      });
    } catch (error) {
      if (error instanceof CardNotFoundError) {
        return c.json({ error: 'Carte non trouvée' }, 404);
      }
      logger.error('Failed to preview scheduling', {
        operation: 'learning:preview:error',
        userId: user.id,
        cardId,
        err: error,
        severity: 'low' as const,
      });
      return c.json({ error: 'Échec de la prévisualisation' }, 500);
    }
  })

  .post('/decks/:id/reset', validate('param', idParam), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    const { id: deckId } = params;

    try {
      const cardsReset = await fsrsService.resetDeck(deckId, user.id);

      logger.info('Deck FSRS reset', {
        operation: 'learning:reset',
        userId: user.id,
        deckId,
        cardsReset,
      });

      return c.json({
        success: true,
        cardsReset,
        message: `${cardsReset} carte${cardsReset > 1 ? 's' : ''} remise${cardsReset > 1 ? 's' : ''} à zéro`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
        return c.json({ error: 'Deck non trouvé' }, 404);
      }

      logger.error('Failed to reset deck', {
        operation: 'learning:reset:error',
        userId: user.id,
        deckId,
        err: error,
        severity: 'medium' as const,
      });
      return c.json({ error: 'Échec de la réinitialisation' }, 500);
    }
  })

  .get('/config', async (c) => {
    const user = c.var.user;
    const level = getUserLevel(user.id, user.schoolLevel);
    const config = getLevelConfig(level);

    return c.json({
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
    });
  });
