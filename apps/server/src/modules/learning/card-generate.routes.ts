import { Hono } from 'hono';
import { z } from 'zod';
import { validate, type AuthEnv } from '../../platform/http/context.js';
import { logger } from '../../platform/observability/logger';
import { checkQuota } from '../billing/index.js';
import { getLevelConfig } from './learning-config.js';
import {
  generateCards,
  isGenerationError,
} from './card-generator.service.js';
import { learningService } from './learning.service.js';
import { getUserLevel } from './routes.helpers.js';
import { checkCards } from './card-check.js';
import { PROMPT_TAG } from '../../lib/prompt-tags.js';
import { SUBJECT_SLUGS } from '../../lib/subjects.js';
import { AppError, toErrorResponse } from '../../platform/http/errors.js';

const generateBody = z.object({
  subject: z.enum(SUBJECT_SLUGS),
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
      if (quota.flashcards === null) {
        return c.json({ error: "La formule n'a pas pu être lue. Réessaie dans un moment.", code: 'PLAN_UNREADABLE' }, 503);
      }
      if (!quota.flashcards) {
        logger.info('Deck generation blocked - free user', {
          operation: 'learning:generate:subscription-required',
          userId: user.id,
        });
        return c.json({
          error: 'Abonnement requis',
          message: 'La génération de cartes de révision est réservée à la formule Complet.',
          code: 'SUBSCRIPTION_REQUIRED',
        }, 403);
      }
      if (!quota.allowed) return c.json(toErrorResponse(new AppError('QUOTA_EXCEEDED')), 429);

      try {
        logger.info('Starting AI deck generation', {
          operation: 'learning:generate:start',
          userId: user.id,
          subject, domaine, hasTopic: Boolean(topic),
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
          owner: { userId: user.id },
        });

        if (isGenerationError(generationResult)) {
          logger.error('AI card generation failed', {
            operation: 'learning:generate:failed',
            userId: user.id,
            reason: generationResult.error,
            code: generationResult.code,
            severity: 'medium' as const,
          });
          return c.json({ error: generationResult.error, code: generationResult.code }, 500);
        }

        // No exercise outside the chat: the tags, with the moderation. Not the equalities: a
        // true-or-false statement or a wrong option is false on purpose.
        const { kept: generatedCards, setAside, unmoderated } = await checkCards(generationResult.cards, (text) => !PROMPT_TAG.test(text));
        if (setAside > 0) {
          logger.warn('Cards set aside by the check', { operation: 'learning:generate:set-aside', userId: user.id, setAside, kept: generatedCards.length });
        }
        if (unmoderated) {
          return c.json({ error: "Les cartes n'ont pas pu être vérifiées. Réessaie dans un moment.", code: 'CARDS_UNCHECKED' }, 503);
        }
        if (generatedCards.length === 0) {
          return c.json({ error: "Aucune carte n'a passé le contrôle. Réessaie avec un autre sujet.", code: 'CARDS_HELD_BACK' }, 422);
        }

        const deckTitle = isFullDomaineMode ? domaine : topic;
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

        logger.info('AI deck generation completed', {
          operation: 'learning:generate:complete',
          userId: user.id,
          deckId: newDeck.id,
          cardsGenerated: insertedCards.length,
          tokensUsed: generationResult.tokensUsed,
        });

        return c.json({
          deck: newDeck,
          cards: insertedCards,
          metadata: {
            tokensUsed: generationResult.tokensUsed,
          },
        });
      } catch (error) {
        logger.error('Failed to generate deck', {
          operation: 'learning:generate:error',
          userId: user.id, subject, domaine,
          hasTopic: Boolean(topic),
          err: error,
          severity: 'high' as const,
        });
        return c.json({ error: 'Échec de la génération du deck' }, 500);
      }
    },
  );
