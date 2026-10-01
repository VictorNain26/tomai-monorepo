import { Hono } from 'hono';
import { z } from 'zod';
import { validate, type AuthEnv } from '../../lib/http.js';
import { logger } from '../../lib/observability';
import { checkQuota, checkDeckQuota, incrementDeckUsage } from '../../services/token-quota.service';
import { getLevelConfig } from '../../config/learning-config.js';
import {
  generateCards,
  isGenerationError,
} from '../../services/learning/index';
import { learningService } from '../../services/learning/learning.service';
import { getUserLevel } from './helpers';


const generateBody = z.object({
  subject: z.string().min(1).max(100),
  domaine: z.string().min(1).max(200),
  topic: z.string().min(1).max(500).optional(),
});

export const cardGenerateRoutes = new Hono<AuthEnv>()
  .post(
    '/generate',
    validate('json', generateBody),
    async (c) => {
      const user = c.var.user;
      const body = c.req.valid('json');
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
        return c.json({
          error: 'Abonnement requis',
          message: 'La génération de cartes de révision est réservée aux comptes premium. Demande à tes parents de souscrire un abonnement !',
          code: 'SUBSCRIPTION_REQUIRED',
        }, 403);
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
        return c.json({
          error: 'Limite atteinte',
          message: deckQuota.message,
          code: 'DECK_LIMIT_REACHED',
          decksRemainingToday: deckQuota.decksRemainingToday,
          decksRemainingThisMonth: deckQuota.decksRemainingThisMonth,
          dailyLimit: deckQuota.dailyLimit,
          monthlyLimit: deckQuota.monthlyLimit,
        }, 429);
      }

      try {
        logger.info('Starting AI deck generation', {
          operation: 'learning:generate:start',
          userId: user.id,
          subject, domaine, topic: topic ?? null,
          mode: isFullDomaineMode ? 'full_domaine' : 'specific_topic',
          schoolLevel: level,
        });

        const levelConfig = getLevelConfig(level);
        const cardCount = isFullDomaineMode
          ? levelConfig.cardsPerSession
          : Math.round(levelConfig.cardsPerSession * 0.6);

        logger.info('Card count from level config', {
          operation: 'learning:generate:cardcount',
          schoolLevel: level, cardsPerSession: levelConfig.cardsPerSession,
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
            reason: generationResult.error,
            _actualError: generationResult._debug?.actualError,
            code: generationResult.code,
            severity: 'medium' as const,
          });
          return c.json({ error: generationResult.error, code: generationResult.code }, 500);
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

        return c.json({
          deck: newDeck,
          cards: insertedCards,
          metadata: {
            tokensUsed: generationResult.tokensUsed,
            decksRemainingToday: deckUsage.decksRemainingToday,
            decksRemainingThisMonth: deckUsage.decksRemainingThisMonth,
          },
        });
      } catch (error) {
        logger.error('Failed to generate deck', {
          operation: 'learning:generate:error',
          userId: user.id, subject, domaine,
          topic: topic ?? null,
          err: error,
          severity: 'high' as const,
        });
        return c.json({ error: 'Échec de la génération du deck' }, 500);
      }
    },
  );
