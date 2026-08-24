import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { logger } from '../../lib/observability';
import { checkQuota, checkDeckQuota, incrementDeckUsage } from '../../services/token-quota.service';
import { getLevelConfig } from '../../config/learning-config.js';
import {
  generateCards,
  isGenerationError,
} from '../../services/learning/index';
import { learningService } from '../../services/learning/learning.service';
import { getUserLevel } from './helpers';

export const cardGenerateRoutes = new Elysia({ prefix: '/api/learning' })
  .use(authMacro)
  .guard({ auth: true })
  .post(
    '/generate',
    async ({ body, user, status }) => {
      const { subject, domaine, topic } = body;

      const isFullDomaineMode = !topic || topic.trim() === '';
      const searchQuery = isFullDomaineMode ? domaine : topic;

      const level = getUserLevel(user.id, user.schoolLevel);

      const quota = await checkQuota(user.id);
      if (quota.plan === 'free') {
        logger.info('Deck generation blocked - free user', {
          operation: 'learning:generate:subscription-required',
          userId: user.id,
          plan: quota.plan,
        });
        return status(403, {
          error: 'Abonnement requis',
          message: 'La génération de cartes de révision est réservée aux comptes premium. Demande à tes parents de souscrire un abonnement !',
          code: 'SUBSCRIPTION_REQUIRED',
        });
      }

      const deckQuota = await checkDeckQuota(user.id);
      if (!deckQuota.allowed) {
        logger.info('Deck generation blocked - limit reached', {
          operation: 'learning:generate:deck-limit',
          userId: user.id,
          decksRemainingToday: deckQuota.decksRemainingToday,
          decksRemainingThisMonth: deckQuota.decksRemainingThisMonth,
          dailyLimit: deckQuota.dailyLimit,
          monthlyLimit: deckQuota.monthlyLimit,
        });
        return status(429, {
          error: 'Limite atteinte',
          message: deckQuota.message,
          code: 'DECK_LIMIT_REACHED',
          decksRemainingToday: deckQuota.decksRemainingToday,
          decksRemainingThisMonth: deckQuota.decksRemainingThisMonth,
          dailyLimit: deckQuota.dailyLimit,
          monthlyLimit: deckQuota.monthlyLimit,
        });
      }

      try {
        logger.info('Starting AI deck generation', {
          operation: 'learning:generate:start',
          userId: user.id,
          subject, domaine, topic: topic ?? null,
          mode: isFullDomaineMode ? 'full_domaine' : 'specific_topic',
          level,
        });

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
          cardCount, domaine,
        });

        if (isGenerationError(generationResult)) {
          logger.error('AI card generation failed', {
            operation: 'learning:generate:failed',
            userId: user.id,
            _error: generationResult.error,
            _actualError: generationResult._debug?.actualError,
            code: generationResult.code,
            severity: 'medium' as const,
          });
          return status(500, { error: generationResult.error, code: generationResult.code });
        }

        const generatedCards = generationResult.cards;

        const deckTitle = isFullDomaineMode ? domaine : (topic ?? domaine);
        const deckDescription = isFullDomaineMode
          ? `Révision complète du domaine "${domaine}" - ${generatedCards.length} cartes`
          : `Cartes sur "${topic}" (${domaine})`;

        const { deck: newDeck, cards: insertedCards } = await learningService.createDeckWithCards({
          userId: user.id,
          deck: {
            title: deckTitle,
            description: deckDescription,
            subject,
            source: 'prompt',
            sourcePrompt: isFullDomaineMode ? domaine : topic,
            schoolLevel: level,
          },
          cards: generatedCards,
        });

        const deckUsage = await incrementDeckUsage(user.id);

        logger.info('AI deck generation completed', {
          operation: 'learning:generate:complete',
          userId: user.id,
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
            tokensUsed: generationResult.tokensUsed,
            decksRemainingToday: deckUsage.decksRemainingToday,
            decksRemainingThisMonth: deckUsage.decksRemainingThisMonth,
          },
        };
      } catch (error) {
        logger.error('Failed to generate deck', {
          operation: 'learning:generate:error',
          userId: user.id, subject, domaine,
          topic: topic ?? null,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        return status(500, { error: 'Échec de la génération du deck' });
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
