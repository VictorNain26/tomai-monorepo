/**
 * Learning Routes - Deck Management
 *
 * CRUD operations for decks (collections of cards).
 * Also includes topics/subjects discovery from RAG.
 */

import { Elysia, t } from 'elysia';
import { db } from '../../db/connection';
import { learningDecks, learningCards } from '../../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { handleAuthWithCookies } from '../../middleware/auth.middleware';
import { logger } from '../../lib/observability';
import { educationService } from '../../services/education.service';
import { qdrantService } from '../../services/qdrant.service';
import { subjectLabels } from './helpers';
import type { EducationLevelType } from '../../types/index';

export const deckRoutes = new Elysia({ prefix: '/api/learning' })

  /**
   * List user's decks
   * GET /api/learning/decks
   */
  .get('/decks', async ({ request, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;

    try {
      const decks = await db
        .select()
        .from(learningDecks)
        .where(eq(learningDecks.userId, authUser.id))
        .orderBy(desc(learningDecks.updatedAt));

      return {
        decks,
        count: decks.length,
      };
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

  /**
   * Create a new deck
   * POST /api/learning/decks
   */
  .post(
    '/decks',
    async ({ request, body, set }) => {
      const authContext = await handleAuthWithCookies(request.headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const { user: authUser } = authContext;
      const { title, description, subject, source, sourceId, sourcePrompt, schoolLevel } = body;

      try {
        const [newDeck] = await db
          .insert(learningDecks)
          .values({
            userId: authUser.id,
            title,
            description,
            subject,
            source,
            sourceId,
            sourcePrompt,
            schoolLevel,
            cardCount: 0,
          })
          .returning();

        if (!newDeck) {
          set.status = 500;
          return { error: 'Failed to create deck' };
        }

        logger.info('Deck created', {
          operation: 'learning:decks:create',
          userId: authUser.id,
          deckId: newDeck.id,
          subject,
          source,
        });

        return {
          deck: newDeck,
        };
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
          t.Literal('prompt'),
          t.Literal('conversation'),
          t.Literal('document'),
          t.Literal('rag_program'),
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

  /**
   * Get a deck with all its cards
   * GET /api/learning/decks/:id
   */
  .get('/decks/:id', async ({ request, params, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { id: deckId } = params;

    try {
      // Get deck (verify ownership)
      const [deck] = await db
        .select()
        .from(learningDecks)
        .where(and(
          eq(learningDecks.id, deckId),
          eq(learningDecks.userId, authUser.id)
        ))
        .limit(1);

      if (!deck) {
        set.status = 404;
        return { error: 'Deck not found' };
      }

      // Get cards ordered by position (FSRS ordering happens in frontend)
      const cards = await db
        .select()
        .from(learningCards)
        .where(eq(learningCards.deckId, deckId))
        .orderBy(asc(learningCards.position));

      return {
        deck,
        cards,
      };
    } catch (error) {
      logger.error('Failed to fetch deck', {
        operation: 'learning:decks:get',
        userId: authUser.id,
        deckId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch deck' };
    }
  })

  /**
   * Update a deck
   * PATCH /api/learning/decks/:id
   */
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
        // Verify ownership
        const [existingDeck] = await db
          .select({ id: learningDecks.id })
          .from(learningDecks)
          .where(and(
            eq(learningDecks.id, deckId),
            eq(learningDecks.userId, authUser.id)
          ))
          .limit(1);

        if (!existingDeck) {
          set.status = 404;
          return { error: 'Deck not found' };
        }

        const [updatedDeck] = await db
          .update(learningDecks)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(learningDecks.id, deckId))
          .returning();

        return { deck: updatedDeck };
      } catch (error) {
        logger.error('Failed to update deck', {
          operation: 'learning:decks:update',
          userId: authUser.id,
          deckId,
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

  /**
   * Delete a deck (cascades to cards)
   * DELETE /api/learning/decks/:id
   */
  .delete('/decks/:id', async ({ request, params, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { id: deckId } = params;

    try {
      // Verify ownership
      const [existingDeck] = await db
        .select({ id: learningDecks.id })
        .from(learningDecks)
        .where(and(
          eq(learningDecks.id, deckId),
          eq(learningDecks.userId, authUser.id)
        ))
        .limit(1);

      if (!existingDeck) {
        set.status = 404;
        return { error: 'Deck not found' };
      }

      // Delete deck (cards cascade automatically via FK)
      await db
        .delete(learningDecks)
        .where(eq(learningDecks.id, deckId));

      logger.info('Deck deleted', {
        operation: 'learning:decks:delete',
        userId: authUser.id,
        deckId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete deck', {
        operation: 'learning:decks:delete',
        userId: authUser.id,
        deckId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to delete deck' };
    }
  })

  /**
   * Get available subjects for a given school level
   * GET /api/learning/subjects?niveau=cinquieme
   *
   * Returns list of subjects that have content in RAG for this level
   */
  .get('/subjects', async ({ request, query, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const niveau = (query.niveau ?? authUser.schoolLevel ?? 'sixieme') as EducationLevelType;

    try {
      const subjects = await educationService.getSubjectsForLevel(niveau);

      const formattedSubjects = subjects.map(s => ({
        id: s.key,
        label: subjectLabels[s.key] || s.key,
      }));

      logger.info('Subjects fetched for level', {
        operation: 'learning:subjects:list',
        userId: authUser.id,
        niveau,
        count: subjects.length,
      });

      return {
        niveau,
        subjects: formattedSubjects,
      };
    } catch (error) {
      logger.error('Failed to fetch subjects', {
        operation: 'learning:subjects:list',
        userId: authUser.id,
        niveau,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch subjects' };
    }
  }, {
    query: t.Object({
      niveau: t.Optional(t.Union([
        t.Literal('cp'), t.Literal('ce1'), t.Literal('ce2'),
        t.Literal('cm1'), t.Literal('cm2'),
        t.Literal('sixieme'), t.Literal('cinquieme'),
        t.Literal('quatrieme'), t.Literal('troisieme'),
        t.Literal('seconde'), t.Literal('premiere'), t.Literal('terminale'),
      ])),
    }),
  })

  /**
   * Get available topics/themes for a given subject and level
   * GET /api/learning/topics?matiere=mathematiques&niveau=cinquieme
   *
   * Returns hierarchical structure: domaines → themes
   * Used for guided topic selection (no free text input)
   */
  .get('/topics', async ({ request, query, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { matiere } = query;
    const niveau = (query.niveau ?? authUser.schoolLevel ?? 'sixieme') as EducationLevelType;

    if (!matiere) {
      set.status = 400;
      return { error: 'matiere is required' };
    }

    try {
      const domaines = await qdrantService.getTopics(matiere, niveau);
      const totalTopics = domaines.reduce((sum, d) => sum + d.themes.length, 0);

      logger.info('Topics fetched from Qdrant', {
        operation: 'learning:topics:list',
        userId: authUser.id,
        matiere,
        niveau,
        domainesCount: domaines.length,
        totalTopics,
      });

      return {
        matiere,
        niveau,
        domaines,
        totalTopics,
      };
    } catch (error) {
      logger.error('Failed to fetch topics', {
        operation: 'learning:topics:list',
        userId: authUser.id,
        matiere,
        niveau,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch topics' };
    }
  }, {
    query: t.Object({
      matiere: t.String({ minLength: 1 }),
      niveau: t.Optional(t.Union([
        t.Literal('cp'), t.Literal('ce1'), t.Literal('ce2'),
        t.Literal('cm1'), t.Literal('cm2'),
        t.Literal('sixieme'), t.Literal('cinquieme'),
        t.Literal('quatrieme'), t.Literal('troisieme'),
        t.Literal('seconde'), t.Literal('premiere'), t.Literal('terminale'),
      ])),
    }),
  });
