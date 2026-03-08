import { Elysia, t } from 'elysia';
import { db } from '../../db/connection';
import { learningDecks, learningCards } from '../../db/schema';
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
import { getUserLevel } from './helpers';

export const cardGenerateRoutes = new Elysia({ prefix: '/api/learning' })
  .post(
    '/generate',
    async ({ request, body, set }) => {
      const authContext = await handleAuthWithCookies(request.headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const { user: authUser } = authContext;
      const { subject, domaine, topic } = body;

      const isFullDomaineMode = !topic || topic.trim() === '';
      const searchQuery = isFullDomaineMode ? domaine : topic;

      const level = getUserLevel(authUser.id, authUser.schoolLevel);

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
          subject, domaine, topic: topic ?? null,
          mode: isFullDomaineMode ? 'full_domaine' : 'specific_topic',
          level,
        });

        const ragResult = await ragService.hybridSearch({
          query: `${searchQuery} ${subject}`,
          niveau: level,
          matiere: subject,
          limit: 20,
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
            userId: authUser.id, subject, domaine,
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
            level, subject,
          };
        }

        const levelConfig = getLevelConfig(level);
        const cardCount = isFullDomaineMode
          ? levelConfig.cardsPerSession
          : Math.round(levelConfig.cardsPerSession * 0.6);

        logger.info('Card count from level config', {
          operation: 'learning:generate:cardcount',
          level, cardsPerSession: levelConfig.cardsPerSession,
          cardCount,
          mode: isFullDomaineMode ? 'full_domaine' : 'specific_topic',
        });

        const generationResult = await generateCards({
          topic: searchQuery, subject, level,
          ragContext: ragResult.context,
          cardCount, domaine,
        });

        if (isGenerationError(generationResult)) {
          logger.error('AI card generation failed', {
            operation: 'learning:generate:failed',
            userId: authUser.id,
            _error: generationResult.error,
            _actualError: generationResult._debug?.actualError,
            code: generationResult.code,
            severity: 'medium' as const,
          });
          set.status = 500;
          return { error: generationResult.error, code: generationResult.code };
        }

        const generatedCards = generationResult.cards;

        const deckTitle = isFullDomaineMode
          ? domaine
          : (ragResult.bestMatchTitle ?? topic ?? domaine);
        const deckDescription = isFullDomaineMode
          ? `Révision complète du domaine "${domaine}" - ${generatedCards.length} cartes`
          : `Cartes sur "${topic}" (${domaine})`;

        const { newDeck, insertedCards } = await db.transaction(async (tx) => {
          const [createdDeck] = await tx
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

          if (!createdDeck) {
            throw new Error('Échec de la création du deck');
          }

          const cardsToInsert = generatedCards.map((card, index) => ({
            deckId: createdDeck.id,
            cardType: card.cardType,
            content: card.content,
            position: index,
            fsrsData: fsrsService.initializeCardFsrsData(),
          }));

          const createdCards = await tx
            .insert(learningCards)
            .values(cardsToInsert)
            .returning();

          if (createdCards.length === 0) {
            throw new Error('Échec de l\'insertion des cartes');
          }

          return { newDeck: createdDeck, insertedCards: createdCards };
        });

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
          userId: authUser.id, subject, domaine,
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
        domaine: t.String({ minLength: 1, maxLength: 200 }),
        topic: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
      }),
    }
  );
