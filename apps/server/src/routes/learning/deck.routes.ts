import { Elysia, t } from 'elysia';
import { handleAuthWithCookies } from '../../middleware/auth.middleware';
import { logger } from '../../lib/observability';
import {
  learningService,
  DeckNotFoundError,
  DeckOwnershipError,
} from '../../services/learning/learning.service';
import { deckDiscoveryRoutes } from './deck-discovery.routes.js';

/**
 * Map a LearningService domain error to an Elysia HTTP response.
 *
 * Per the service contract (see learning-errors.ts), both "not found" and
 * "ownership mismatch" surface as HTTP 404 so the API does not leak the
 * existence of another user's deck. The distinct error *code* in the body
 * lets internal callers and tests disambiguate without exposing resource
 * existence externally.
 *
 * Returns the response body when the error was handled, or `null` when the
 * error was not a known domain error (caller must rethrow).
 *
 * `set` is typed loosely (`status?: unknown`) because Elysia's own `set`
 * carries more than just `status` (headers, redirect, cookies) and typing
 * it strictly fights the framework. We only *assign* to `status`, so the
 * unknown input type is safe.
 */
function handleDeckDomainError(
  err: unknown,
  set: { status?: unknown },
): { success: false; error: 'DECK_NOT_FOUND' | 'DECK_FORBIDDEN' } | null {
  if (err instanceof DeckNotFoundError) {
    set.status = 404;
    return { success: false, error: 'DECK_NOT_FOUND' };
  }
  if (err instanceof DeckOwnershipError) {
    set.status = 404;
    return { success: false, error: 'DECK_FORBIDDEN' };
  }
  return null;
}

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
      return await learningService.getDeckWithCardsOrThrow(authUser.id, deckId);
    } catch (error) {
      const domain = handleDeckDomainError(error, set);
      if (domain) return domain;
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
        const updatedDeck = await learningService.updateDeckOrThrow(authUser.id, deckId, body);
        return { deck: updatedDeck };
      } catch (error) {
        const domain = handleDeckDomainError(error, set);
        if (domain) return domain;
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
      await learningService.deleteDeckOrThrow(authUser.id, deckId);
      return { success: true };
    } catch (error) {
      const domain = handleDeckDomainError(error, set);
      if (domain) return domain;
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
