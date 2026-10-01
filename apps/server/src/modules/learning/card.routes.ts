import { Hono } from 'hono';
import { z } from 'zod';
import { validate, type AuthEnv } from '../../platform/http/context.js';
import { logger } from '../../platform/observability/logger';
import {
  learningService,
  CardNotFoundError,
  CardValidationError,
} from './learning.service.js';
import { handleDeckDomainError, idParam } from './routes.helpers.js';


const cardType = z.enum(['flashcard', 'qcm', 'vrai_faux']);

const addCardsBody = z.object({
  cards: z.array(z.object({
    cardType,
    content: z.record(z.string(), z.unknown()),
    position: z.number().optional(),
  })).min(1),
});

const updateCardBody = z.object({
  cardType: cardType.optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  position: z.number().optional(),
});

export const cardRoutes = new Hono<AuthEnv>()

  .post(
    '/decks/:id/cards',
    validate('param', idParam),
    validate('json', addCardsBody),
    async (c) => {
      const user = c.var.user;
      const params = c.req.valid('param');
      const body = c.req.valid('json');
      const { id: deckId } = params;
      const { cards } = body;

      try {
        const insertedCards = await learningService.addCardsToDeckOrThrow(user.id, deckId, {
          cards: cards.map((card) => ({
            cardType: card.cardType,
            content: card.content,
            position: card.position,
          })),
        });

        logger.info('Cards added to deck', {
          operation: 'learning:cards:add',
          userId: user.id, deckId, cardsAdded: insertedCards.length,
        });

        return c.json({ cards: insertedCards, count: insertedCards.length });
      } catch (error) {
        if (error instanceof CardValidationError) {
          return c.json({ error: error.message }, 400);
        }
        const domain = handleDeckDomainError(error);
        if (domain) return c.json(domain.body, domain.status);
        logger.error('Failed to add cards', {
          operation: 'learning:cards:add',
          userId: user.id, deckId,
          err: error,
          severity: 'medium' as const,
        });
        return c.json({ error: 'Failed to add cards' }, 500);
      }
    },
  )

  .patch(
    '/cards/:id',
    validate('param', idParam),
    validate('json', updateCardBody),
    async (c) => {
      const user = c.var.user;
      const params = c.req.valid('param');
      const body = c.req.valid('json');
      const { id: cardId } = params;

      try {
        const updatedCard = await learningService.updateCardOrThrow(user.id, cardId, body);
        return c.json({ card: updatedCard });
      } catch (error) {
        if (error instanceof CardValidationError) {
          return c.json({ error: error.message }, 400);
        }
        if (error instanceof CardNotFoundError) {
          return c.json({ error: 'Card not found' }, 404);
        }
        logger.error('Failed to update card', {
          operation: 'learning:cards:update',
          userId: user.id, cardId,
          err: error,
          severity: 'medium' as const,
        });
        return c.json({ error: 'Failed to update card' }, 500);
      }
    },
  )

  .delete('/cards/:id', validate('param', idParam), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    const { id: cardId } = params;

    try {
      await learningService.deleteCardOrThrow(user.id, cardId);
      return c.json({ success: true });
    } catch (error) {
      if (error instanceof CardNotFoundError) {
        return c.json({ error: 'Card not found' }, 404);
      }
      logger.error('Failed to delete card', {
        operation: 'learning:cards:delete',
        userId: user.id, cardId,
        err: error,
        severity: 'medium' as const,
      });
      return c.json({ error: 'Failed to delete card' }, 500);
    }
  });
