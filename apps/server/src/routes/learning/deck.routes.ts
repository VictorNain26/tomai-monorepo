import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { logger } from '../../lib/observability';
import { learningService } from '../../services/learning/learning.service';
import { handleDeckDomainError } from './helpers';
import { deckDiscoveryRoutes } from './deck-discovery.routes.js';

export const deckRoutes = new Elysia({ prefix: '/api/learning' })
  .use(authMacro)
  .guard({ auth: true })

  .get('/decks', async ({ user, set }) => {
    try {
      const decks = await learningService.listUserDecks(user.id);
      return { decks, count: decks.length };
    } catch (error) {
      logger.error('Failed to fetch decks', {
        operation: 'learning:decks:list',
        userId: user.id,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch decks' };
    }
  })

  .post(
    '/decks',
    async ({ body, user, set }) => {
      try {
        // Empty deck creation — caller will populate cards via other endpoints.
        const { deck: newDeck } = await learningService.createDeckWithCards({
          userId: user.id,
          deck: body,
          cards: [],
        });

        logger.info('Deck created', {
          operation: 'learning:decks:create',
          userId: user.id, deckId: newDeck.id,
          subject: body.subject, source: body.source,
        });

        return { deck: newDeck };
      } catch (error) {
        logger.error('Failed to create deck', {
          operation: 'learning:decks:create',
          userId: user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'medium' as const,
        });
        set.status = 500;
        return { error: 'Failed to create deck' };
      }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String()),
        subject: t.String({ minLength: 1, maxLength: 100 }),
        source: t.Union([
          t.Literal('prompt'), t.Literal('conversation'),
          t.Literal('document'), t.Literal('rag_program'),
        ]),
        sourceId: t.Optional(t.String()),
        sourcePrompt: t.Optional(t.String()),
        schoolLevel: t.Optional(t.Union([
          t.Literal('cp'), t.Literal('ce1'), t.Literal('ce2'),
          t.Literal('cm1'), t.Literal('cm2'),
          t.Literal('sixieme'), t.Literal('cinquieme'),
          t.Literal('quatrieme'), t.Literal('troisieme'),
          t.Literal('seconde'), t.Literal('premiere'), t.Literal('terminale'),
        ])),
      }),
    }
  )

  .get('/decks/:id', async ({ params, user, set }) => {
    const { id: deckId } = params;

    try {
      return await learningService.getDeckWithCardsOrThrow(user.id, deckId);
    } catch (error) {
      const domain = handleDeckDomainError(error, set);
      if (domain) return domain;
      logger.error('Failed to fetch deck', {
        operation: 'learning:decks:get',
        userId: user.id, deckId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch deck' };
    }
  })

  .patch(
    '/decks/:id',
    async ({ params, body, user, set }) => {
      const { id: deckId } = params;

      try {
        const updatedDeck = await learningService.updateDeckOrThrow(user.id, deckId, body);
        return { deck: updatedDeck };
      } catch (error) {
        const domain = handleDeckDomainError(error, set);
        if (domain) return domain;
        logger.error('Failed to update deck', {
          operation: 'learning:decks:update',
          userId: user.id, deckId,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'medium' as const,
        });
        set.status = 500;
        return { error: 'Failed to update deck' };
      }
    },
    {
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        description: t.Optional(t.String()),
        subject: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      }),
    }
  )

  .delete('/decks/:id', async ({ params, user, set }) => {
    const { id: deckId } = params;

    try {
      await learningService.deleteDeckOrThrow(user.id, deckId);
      return { success: true };
    } catch (error) {
      const domain = handleDeckDomainError(error, set);
      if (domain) return domain;
      logger.error('Failed to delete deck', {
        operation: 'learning:decks:delete',
        userId: user.id, deckId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to delete deck' };
    }
  })

  // Mount discovery routes (subjects, topics, chapters)
  .use(deckDiscoveryRoutes);
