/**
 * Learning Routes - Card Management & AI Generation
 *
 * CRUD operations for cards (flashcard, qcm, vrai_faux).
 * Includes AI generation endpoint using RAG + Gemini.
 */

import { Elysia, t } from 'elysia';
import { db } from '../../db/connection';
import { learningDecks, learningCards } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { handleAuthWithCookies } from '../../middleware/auth.middleware';
import { logger } from '../../lib/observability';
import { ragService } from '../../services/rag.service';
import { checkQuota, checkDeckQuota, incrementDeckUsage } from '../../services/token-quota.service';
import { fsrsService } from '../../services/fsrs.service';
import { getLevelConfig } from '../../config/learning-config.js';
import {
  generateCards,
  isGenerationError,
} from '../../services/learning/index';
import { getUserLevel, validateCardContent } from './helpers';

export const cardRoutes = new Elysia({ prefix: '/api/learning' })

  /**
   * Add cards to a deck
   * POST /api/learning/decks/:id/cards
   */
  .post(
    '/decks/:id/cards',
    async ({ request, params, body, set }) => {
      const authContext = await handleAuthWithCookies(request.headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const { user: authUser } = authContext;
      const { id: deckId } = params;
      const { cards } = body;

      try {
        // Verify deck ownership
        const [deck] = await db
          .select({ id: learningDecks.id, cardCount: learningDecks.cardCount })
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

        // Validate all cards
        for (const [i, card] of cards.entries()) {
          const validation = validateCardContent(card.cardType, card.content as Record<string, unknown>);
          if (!validation.valid) {
            set.status = 400;
            return { error: `Card ${i}: ${validation.error}` };
          }
        }

        // Insert cards with positions, default difficulty, and FSRS initialization
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

        // Update deck card count
        await db
          .update(learningDecks)
          .set({
            cardCount: deck.cardCount + cards.length,
            updatedAt: new Date(),
          })
          .where(eq(learningDecks.id, deckId));

        logger.info('Cards added to deck', {
          operation: 'learning:cards:add',
          userId: authUser.id,
          deckId,
          cardsAdded: cards.length,
        });

        return {
          cards: insertedCards,
          count: insertedCards.length,
        };
      } catch (error) {
        logger.error('Failed to add cards', {
          operation: 'learning:cards:add',
          userId: authUser.id,
          deckId,
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

  /**
   * Update a card
   * PATCH /api/learning/cards/:id
   */
  .patch(
    '/cards/:id',
    async ({ request, params, body, set }) => {
      const authContext = await handleAuthWithCookies(request.headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const { user: authUser } = authContext;
      const { id: cardId } = params;

      try {
        // Get card with deck info for ownership check
        const [card] = await db
          .select({
            card: learningCards,
            deckUserId: learningDecks.userId,
          })
          .from(learningCards)
          .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
          .where(eq(learningCards.id, cardId))
          .limit(1);

        if (!card || card.deckUserId !== authUser.id) {
          set.status = 404;
          return { error: 'Card not found' };
        }

        // Validate content if provided
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
          userId: authUser.id,
          cardId,
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

  /**
   * Delete a card
   * DELETE /api/learning/cards/:id
   */
  .delete('/cards/:id', async ({ request, params, set }) => {
    const authContext = await handleAuthWithCookies(request.headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    const { user: authUser } = authContext;
    const { id: cardId } = params;

    try {
      // Get card with deck info for ownership check
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

      if (!card || card.deckUserId !== authUser.id) {
        set.status = 404;
        return { error: 'Card not found' };
      }

      // Delete card
      await db
        .delete(learningCards)
        .where(eq(learningCards.id, cardId));

      // Count remaining cards and update deck
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
        userId: authUser.id,
        cardId,
        deckId: card.deckId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete card', {
        operation: 'learning:cards:delete',
        userId: authUser.id,
        cardId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to delete card' };
    }
  })

  /**
   * Generate a deck with AI from domaine + optional topic
   * Uses RAG for curriculum alignment + Gemini for card generation
   *
   * Deux modes de génération:
   * 1. Domaine seul → génère sur tout le domaine (ex: toute la Conjugaison)
   * 2. Domaine + topic → génère sur le sous-chapitre spécifique (ex: Conditionnel)
   *
   * POST /api/learning/generate
   */
  .post(
    '/generate',
    async ({ request, body, set }) => {
      const authContext = await handleAuthWithCookies(request.headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const { user: authUser } = authContext;
      const { subject, domaine, topic } = body;

      // Mode de génération: domaine complet ou sous-chapitre
      const isFullDomaineMode = !topic || topic.trim() === '';
      const searchQuery = isFullDomaineMode ? domaine : topic;

      // Always use user profile level
      const level = getUserLevel(authUser.id, authUser.schoolLevel);

      // Subscription check: deck generation is premium only
      const quota = await checkQuota(authUser.id);
      if (quota.plan === 'free') {
        logger.info('Deck generation blocked - free user', {
          operation: 'learning:generate:subscription-required',
          userId: authUser.id,
          plan: quota.plan,
        });
        set.status = 403;
        return {
          error: 'Abonnement requis',
          message: 'La génération de cartes de révision est réservée aux comptes premium. Demande à tes parents de souscrire un abonnement !',
          code: 'SUBSCRIPTION_REQUIRED',
        };
      }

      // Deck quota check: max 5 decks/day and 50/month for premium
      const deckQuota = await checkDeckQuota(authUser.id);
      if (!deckQuota.allowed) {
        logger.info('Deck generation blocked - limit reached', {
          operation: 'learning:generate:deck-limit',
          userId: authUser.id,
          decksRemainingToday: deckQuota.decksRemainingToday,
          decksRemainingThisMonth: deckQuota.decksRemainingThisMonth,
          dailyLimit: deckQuota.dailyLimit,
          monthlyLimit: deckQuota.monthlyLimit,
        });
        set.status = 429;
        return {
          error: 'Limite atteinte',
          message: deckQuota.message,
          code: 'DECK_LIMIT_REACHED',
          decksRemainingToday: deckQuota.decksRemainingToday,
          decksRemainingThisMonth: deckQuota.decksRemainingThisMonth,
          dailyLimit: deckQuota.dailyLimit,
          monthlyLimit: deckQuota.monthlyLimit,
        };
      }

      try {
        logger.info('Starting AI deck generation', {
          operation: 'learning:generate:start',
          userId: authUser.id,
          subject,
          domaine,
          topic: topic ?? null,
          mode: isFullDomaineMode ? 'full_domaine' : 'specific_topic',
          level,
        });

        // 1. Get RAG context for curriculum alignment
        // Le threshold de similarité (0.35) filtre automatiquement les résultats non pertinents
        const ragResult = await ragService.hybridSearch({
          query: `${searchQuery} ${subject}`,
          niveau: level,
          matiere: subject,
          limit: 20, // Récupérer assez de contexte, le threshold élimine les non-pertinents
        });

        const ragThresholds = ragService.getThresholds();

        logger.info('RAG context retrieved', {
          operation: 'learning:generate:rag',
          userId: authUser.id,
          strategy: ragResult.strategy,
          chunksFound: ragResult.semanticChunks.length,
          avgSimilarity: ragResult.averageSimilarity.toFixed(3),
          threshold: ragThresholds.GOOD_SCORE,
        });

        // 2. Strict validation: RAG is the source of truth
        const hasValidResults = ragResult.semanticChunks.length > 0;
        const hasGoodSimilarity = ragResult.averageSimilarity >= ragThresholds.GOOD_SCORE;
        const isRagDisabled = ragResult.strategy === 'disabled';

        if (isRagDisabled || !hasValidResults || !hasGoodSimilarity) {
          const errorReason = isRagDisabled
            ? 'Service RAG temporairement indisponible'
            : isFullDomaineMode
              ? 'Domaine non trouvé dans ton programme'
              : 'Thème non trouvé dans ton programme';

          logger.warn('RAG validation failed - cannot generate without official context', {
            operation: 'learning:generate:rag-validation-failed',
            userId: authUser.id,
            subject,
            domaine,
            topic: topic ?? null,
            mode: isFullDomaineMode ? 'full_domaine' : 'specific_topic',
            level,
            reason: isRagDisabled ? 'rag_disabled' : 'insufficient_context',
            chunksFound: ragResult.semanticChunks.length,
            avgSimilarity: ragResult.averageSimilarity.toFixed(3),
            threshold: ragThresholds.GOOD_SCORE,
          });
          set.status = isRagDisabled ? 503 : 400;
          return {
            error: errorReason,
            message: isRagDisabled
              ? 'Le service de programmes officiels est temporairement indisponible. Réessaie dans quelques minutes.'
              : `Je n'ai pas trouvé "${searchQuery}" dans le programme de ${subject} pour ton niveau. Cela peut arriver si le thème n'est pas au programme ou si l'orthographe est différente.`,
            suggestions: isRagDisabled
              ? ['Réessaie dans quelques minutes']
              : [
                  'Vérifie l\'orthographe du thème',
                  'Essaie avec des mots-clés plus simples',
                  'Choisis un chapitre de ton livre scolaire',
                ],
            code: isRagDisabled ? 'RAG_SERVICE_UNAVAILABLE' : 'TOPIC_NOT_IN_CURRICULUM',
            level,
            subject,
          };
        }

        // 3. Calculer cardCount basé sur la config scientifique par niveau
        // Source: learning-config.ts (Éduscol, DRANE, Primlangues)
        const levelConfig = getLevelConfig(level);
        // Mode domaine complet: 100% du max recommandé pour le niveau
        // Mode topic spécifique: 60% du max (session équilibrée)
        const cardCount = isFullDomaineMode
          ? levelConfig.cardsPerSession
          : Math.round(levelConfig.cardsPerSession * 0.6);

        logger.info('Card count from level config', {
          operation: 'learning:generate:cardcount',
          level,
          cardsPerSession: levelConfig.cardsPerSession,
          cardCount,
          mode: isFullDomaineMode ? 'full_domaine' : 'specific_topic',
        });

        // 4. Generate cards with structured output
        const generationResult = await generateCards({
          topic: searchQuery,
          subject,
          level,
          ragContext: ragResult.context,
          cardCount,
          domaine,
        });

        // 5. Check for generation errors
        if (isGenerationError(generationResult)) {
          logger.error('AI card generation failed', {
            operation: 'learning:generate:failed',
            userId: authUser.id,
            _error: generationResult.error,
            code: generationResult.code,
            severity: 'medium' as const,
          });
          set.status = 500;
          return { error: generationResult.error };
        }

        const generatedCards = generationResult.cards;

        // 5. Create deck with appropriate title based on mode
        const deckTitle = isFullDomaineMode
          ? domaine
          : (ragResult.bestMatchTitle ?? topic ?? domaine);
        const deckDescription = isFullDomaineMode
          ? `Révision complète du domaine "${domaine}" - ${generatedCards.length} cartes`
          : `Cartes sur "${topic}" (${domaine})`;

        const [newDeck] = await db
          .insert(learningDecks)
          .values({
            userId: authUser.id,
            title: deckTitle,
            description: deckDescription,
            subject,
            source: 'rag_program',
            sourcePrompt: isFullDomaineMode ? domaine : topic,
            schoolLevel: level,
            cardCount: generatedCards.length,
          })
          .returning();

        if (!newDeck) {
          set.status = 500;
          return { error: 'Échec de la création du deck' };
        }

        // 6. Insert generated cards with FSRS initial data
        const cardsToInsert = generatedCards.map((card, index) => ({
          deckId: newDeck.id,
          cardType: card.cardType,
          content: card.content,
          position: index,
          fsrsData: fsrsService.initializeCardFsrsData(),
        }));

        const insertedCards = await db
          .insert(learningCards)
          .values(cardsToInsert)
          .returning();

        // Increment deck counter after successful generation
        const deckUsage = await incrementDeckUsage(authUser.id);

        logger.info('AI deck generation completed', {
          operation: 'learning:generate:complete',
          userId: authUser.id,
          deckId: newDeck.id,
          cardsGenerated: insertedCards.length,
          tokensUsed: generationResult.tokensUsed,
          decksGeneratedToday: deckUsage.newDecksGeneratedToday,
          decksGeneratedThisMonth: deckUsage.newDecksGeneratedThisMonth,
          decksRemainingToday: deckUsage.decksRemainingToday,
          decksRemainingThisMonth: deckUsage.decksRemainingThisMonth,
        });

        return {
          deck: newDeck,
          cards: insertedCards,
          metadata: {
            ragStrategy: ragResult.strategy,
            tokensUsed: generationResult.tokensUsed,
            decksRemainingToday: deckUsage.decksRemainingToday,
            decksRemainingThisMonth: deckUsage.decksRemainingThisMonth,
          },
        };
      } catch (error) {
        logger.error('Failed to generate deck', {
          operation: 'learning:generate:error',
          userId: authUser.id,
          subject,
          domaine,
          topic: topic ?? null,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        set.status = 500;
        return { error: 'Échec de la génération du deck' };
      }
    },
    {
      body: t.Object({
        subject: t.String({ minLength: 1, maxLength: 100 }),
        /** Domaine obligatoire (ex: "Conjugaison", "Grammaire") */
        domaine: t.String({ minLength: 1, maxLength: 200 }),
        /** Sous-chapitre optionnel - si absent, génère sur tout le domaine */
        topic: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
      }),
    }
  );
