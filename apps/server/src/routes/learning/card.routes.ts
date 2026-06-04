import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { logger } from '../../lib/observability';
import {
  learningService,
  CardNotFoundError,
  CardValidationError,
} from '../../services/learning/learning.service';
import { handleDeckDomainError } from './helpers';

export const cardRoutes = new Elysia({ prefix: '/api/learning' })
  .use(authMacro)
  .guard({ auth: true })

  .post(
    '/decks/:id/cards',
    async ({ params, body, user, status }) => {
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

        return { cards: insertedCards, count: insertedCards.length };
      } catch (error) {
        if (error instanceof CardValidationError) {
          return status(400, { error: error.message });
        }
        const domain = handleDeckDomainError(error);
        if (domain) return status(domain.status, domain.body);
        logger.error('Failed to add cards', {
          operation: 'learning:cards:add',
          userId: user.id, deckId,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'medium' as const,
        });
        return status(500, { error: 'Failed to add cards' });
      }
    },
    {
      body: t.Object({
        cards: t.Array(
          t.Object({
            cardType: t.Union([
              t.Literal('flashcard'),
              t.Literal('qcm'),
              t.Literal('vrai_faux'),
            ]),
            content: t.Record(t.String(), t.Unknown()),
            position: t.Optional(t.Number()),
          }),
          { minItems: 1 }
        ),
      }),
    }
  )

  .patch(
    '/cards/:id',
    async ({ params, body, user, status }) => {
      const { id: cardId } = params;

      try {
        const updatedCard = await learningService.updateCardOrThrow(user.id, cardId, body);
        return { card: updatedCard };
      } catch (error) {
        if (error instanceof CardValidationError) {
          return status(400, { error: error.message });
        }
        if (error instanceof CardNotFoundError) {
          return status(404, { error: 'Card not found' });
        }
        logger.error('Failed to update card', {
          operation: 'learning:cards:update',
          userId: user.id, cardId,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'medium' as const,
        });
        return status(500, { error: 'Failed to update card' });
      }
    },
    {
      body: t.Object({
        cardType: t.Optional(t.Union([
          t.Literal('flashcard'),
          t.Literal('qcm'),
          t.Literal('vrai_faux'),
        ])),
        content: t.Optional(t.Record(t.String(), t.Unknown())),
        position: t.Optional(t.Number()),
      }),
    }
  )

  .delete('/cards/:id', async ({ params, user, status }) => {
    const { id: cardId } = params;

    try {
      await learningService.deleteCardOrThrow(user.id, cardId);
      return { success: true };
    } catch (error) {
      if (error instanceof CardNotFoundError) {
        return status(404, { error: 'Card not found' });
      }
      logger.error('Failed to delete card', {
        operation: 'learning:cards:delete',
        userId: user.id, cardId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return status(500, { error: 'Failed to delete card' });
    }
  });
