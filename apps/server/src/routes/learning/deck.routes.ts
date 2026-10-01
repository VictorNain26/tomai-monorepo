import { Hono } from 'hono';
import { z } from 'zod';
import { validate, type AuthEnv } from '../../lib/http.js';
import { educationLevelSchema } from '../../lib/education-levels.js';
import { logger } from '../../lib/observability';
import { learningService } from '../../services/learning/learning.service';
import { handleDeckDomainError } from './helpers';


const createDeckBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  subject: z.string().min(1).max(100),
  source: z.enum(['prompt', 'conversation', 'document', 'rag_program']),
  sourceId: z.string().optional(),
  sourcePrompt: z.string().optional(),
  schoolLevel: educationLevelSchema.optional(),
});

const updateDeckBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  subject: z.string().min(1).max(100).optional(),
});

export const deckRoutes = new Hono<AuthEnv>()

  .get('/decks', async (c) => {
    const user = c.var.user;
    try {
      const decks = await learningService.listUserDecks(user.id);
      return c.json({ decks, count: decks.length });
    } catch (error) {
      logger.error('Failed to fetch decks', {
        operation: 'learning:decks:list',
        userId: user.id,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return c.json({ error: 'Failed to fetch decks' }, 500);
    }
  })

  .post(
    '/decks',
    validate('json', createDeckBody),
    async (c) => {
      const user = c.var.user;
      const body = c.req.valid('json');
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

        return c.json({ deck: newDeck });
      } catch (error) {
        logger.error('Failed to create deck', {
          operation: 'learning:decks:create',
          userId: user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'medium' as const,
        });
        return c.json({ error: 'Failed to create deck' }, 500);
      }
    },
  )

  .get('/decks/:id', async (c) => {
    const user = c.var.user;
    const params = c.req.param();
    const { id: deckId } = params;

    try {
      return c.json(await learningService.getDeckWithCardsOrThrow(user.id, deckId));
    } catch (error) {
      const domain = handleDeckDomainError(error);
      if (domain) return c.json(domain.body, domain.status);
      logger.error('Failed to fetch deck', {
        operation: 'learning:decks:get',
        userId: user.id, deckId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return c.json({ error: 'Failed to fetch deck' }, 500);
    }
  })

  .patch(
    '/decks/:id',
    validate('json', updateDeckBody),
    async (c) => {
      const user = c.var.user;
      const params = c.req.param();
      const body = c.req.valid('json');
      const { id: deckId } = params;

      try {
        const updatedDeck = await learningService.updateDeckOrThrow(user.id, deckId, body);
        return c.json({ deck: updatedDeck });
      } catch (error) {
        const domain = handleDeckDomainError(error);
        if (domain) return c.json(domain.body, domain.status);
        logger.error('Failed to update deck', {
          operation: 'learning:decks:update',
          userId: user.id, deckId,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'medium' as const,
        });
        return c.json({ error: 'Failed to update deck' }, 500);
      }
    },
  )

  .delete('/decks/:id', async (c) => {
    const user = c.var.user;
    const params = c.req.param();
    const { id: deckId } = params;

    try {
      await learningService.deleteDeckOrThrow(user.id, deckId);
      return c.json({ success: true });
    } catch (error) {
      const domain = handleDeckDomainError(error);
      if (domain) return c.json(domain.body, domain.status);
      logger.error('Failed to delete deck', {
        operation: 'learning:decks:delete',
        userId: user.id, deckId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return c.json({ error: 'Failed to delete deck' }, 500);
    }
  });
