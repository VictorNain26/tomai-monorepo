import { Elysia, t } from 'elysia';
import { db } from '../../db/connection';
import { learningDecks, learningCards } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMacro } from '../../lib/auth-macro';
import { logger } from '../../lib/observability';
import { fsrsService } from '../../services/fsrs.service';
import { validateCardContent } from './helpers';
import { cardGenerateRoutes } from './card-generate.routes.js';

export const cardRoutes = new Elysia({ prefix: '/api/learning' })
  .use(authMacro)
  .guard({ auth: true })

  .post(
    '/decks/:id/cards',
    async ({ params, body, user, set }) => {
      const { id: deckId } = params;
      const { cards } = body;

      try {
        const [deck] = await db
          .select({ id: learningDecks.id, cardCount: learningDecks.cardCount })
          .from(learningDecks)
          .where(and(
            eq(learningDecks.id, deckId),
            eq(learningDecks.userId, user.id)
          ))
          .limit(1);

        if (!deck) {
          set.status = 404;
          return { error: 'Deck not found' };
        }

        for (const [i, card] of cards.entries()) {
          const validation = validateCardContent(card.cardType, card.content as Record<string, unknown>);
          if (!validation.valid) {
            set.status = 400;
            return { error: `Card ${i}: ${validation.error}` };
          }
        }

        const startPosition = deck.cardCount;
        const cardsToInsert = cards.map((card, index) => ({
          deckId,
          cardType: card.cardType,
          difficulty: 'standard' as const,
          content: card.content,
          position: card.position ?? startPosition + index,
          fsrsData: fsrsService.initializeCardFsrsData(),
        }));

        const insertedCards = await db
          .insert(learningCards)
          .values(cardsToInsert)
          .returning();

        await db
          .update(learningDecks)
          .set({
            cardCount: deck.cardCount + cards.length,
            updatedAt: new Date(),
          })
          .where(eq(learningDecks.id, deckId));

        logger.info('Cards added to deck', {
          operation: 'learning:cards:add',
          userId: user.id, deckId, cardsAdded: cards.length,
        });

        return { cards: insertedCards, count: insertedCards.length };
      } catch (error) {
        logger.error('Failed to add cards', {
          operation: 'learning:cards:add',
          userId: user.id, deckId,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'medium' as const,
        });
        set.status = 500;
        return { error: 'Failed to add cards' };
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
    async ({ params, body, user, set }) => {
      const { id: cardId } = params;

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

        if (!card || card.deckUserId !== user.id) {
          set.status = 404;
          return { error: 'Card not found' };
        }

        if (body.content) {
          const cardType = body.cardType ?? card.card.cardType;
          const validation = validateCardContent(cardType, body.content as Record<string, unknown>);
          if (!validation.valid) {
            set.status = 400;
            return { error: validation.error };
          }
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (body.content) updateData.content = body.content;
        if (body.position !== undefined) updateData.position = body.position;

        const [updatedCard] = await db
          .update(learningCards)
          .set(updateData)
          .where(eq(learningCards.id, cardId))
          .returning();

        return { card: updatedCard };
      } catch (error) {
        logger.error('Failed to update card', {
          operation: 'learning:cards:update',
          userId: user.id, cardId,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'medium' as const,
        });
        set.status = 500;
        return { error: 'Failed to update card' };
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

  .delete('/cards/:id', async ({ params, user, set }) => {
    const { id: cardId } = params;

    try {
      const [card] = await db
        .select({
          card: learningCards,
          deckUserId: learningDecks.userId,
          deckId: learningDecks.id,
        })
        .from(learningCards)
        .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
        .where(eq(learningCards.id, cardId))
        .limit(1);

      if (!card || card.deckUserId !== user.id) {
        set.status = 404;
        return { error: 'Card not found' };
      }

      await db
        .delete(learningCards)
        .where(eq(learningCards.id, cardId));

      const cardsRemaining = await db
        .select({ id: learningCards.id })
        .from(learningCards)
        .where(eq(learningCards.deckId, card.deckId));

      await db
        .update(learningDecks)
        .set({
          cardCount: cardsRemaining.length,
          updatedAt: new Date(),
        })
        .where(eq(learningDecks.id, card.deckId));

      logger.info('Card deleted', {
        operation: 'learning:cards:delete',
        userId: user.id, cardId, deckId: card.deckId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete card', {
        operation: 'learning:cards:delete',
        userId: user.id, cardId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to delete card' };
    }
  })

  // Mount AI generation route
  .use(cardGenerateRoutes);
