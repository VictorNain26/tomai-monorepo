import { Elysia, t } from 'elysia';
import { handleAuthWithCookies } from '../../middleware/auth.middleware';
import { logger } from '../../lib/observability';
import { learningService } from '../../services/learning/learning.service';
import { deckDiscoveryRoutes } from './deck-discovery.routes.js';

export const deckRoutes = new Elysia({ prefix: '/api/learning' })

  .get('/decks', async ({ request, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;

    try {
      const decks = await learningService.listUserDecks(authUser.id);
      return { decks, count: decks.length };
    } catch (error) {
      logger.error('Failed to fetch decks', {
        operation: 'learning:decks:list',
        userId: authUser.id,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch decks' };
    }
  })

  .post(
    '/decks',
    async ({ request, body, set }) => {
      const authContext = await handleAuthWithCookies(request.headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const { user: authUser } = authContext;

      try {
        // Empty deck creation — caller will populate cards via other endpoints.
        const { deck: newDeck } = await learningService.createDeckWithCards({
          userId: authUser.id,
          deck: body,
          cards: [],
        });

        logger.info('Deck created', {
          operation: 'learning:decks:create',
          userId: authUser.id, deckId: newDeck.id,
          subject: body.subject, source: body.source,
        });

        return { deck: newDeck };
      } catch (error) {
        logger.error('Failed to create deck', {
          operation: 'learning:decks:create',
          userId: authUser.id,
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

  .get('/decks/:id', async ({ request, params, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { id: deckId } = params;

    try {
      const result = await learningService.getDeckWithCards(authUser.id, deckId);
      if (!result) {
        set.status = 404;
        return { error: 'Deck not found' };
      }
      return result;
    } catch (error) {
      logger.error('Failed to fetch deck', {
        operation: 'learning:decks:get',
        userId: authUser.id, deckId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch deck' };
    }
  })

  .patch(
    '/decks/:id',
    async ({ request, params, body, set }) => {
      const authContext = await handleAuthWithCookies(request.headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const { user: authUser } = authContext;
      const { id: deckId } = params;

      try {
        const updatedDeck = await learningService.updateDeck(authUser.id, deckId, body);
        if (!updatedDeck) {
          set.status = 404;
          return { error: 'Deck not found' };
        }
        return { deck: updatedDeck };
      } catch (error) {
        logger.error('Failed to update deck', {
          operation: 'learning:decks:update',
          userId: authUser.id, deckId,
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

  .delete('/decks/:id', async ({ request, params, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { id: deckId } = params;

    try {
      const deleted = await learningService.deleteDeck(authUser.id, deckId);
      if (!deleted) {
        set.status = 404;
        return { error: 'Deck not found' };
      }
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete deck', {
        operation: 'learning:decks:delete',
        userId: authUser.id, deckId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to delete deck' };
    }
  })

  // Mount discovery routes (subjects, topics, chapters)
  .use(deckDiscoveryRoutes);
