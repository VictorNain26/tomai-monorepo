/**
 * Waitlist Routes - Public endpoint for landing page email collection
 */

import { Elysia, t } from 'elysia';
import { waitlistRepository } from '../db/repositories/waitlist.repository.js';
import { logger } from '../lib/observability.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../middleware/rate-limit.middleware.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const waitlistRoutes = new Elysia({ name: 'waitlist-routes' })
  .onBeforeHandle(createRateLimitMiddleware(RateLimitPresets.public))
  .post('/api/waitlist', async ({ body, status }) => {
    const { email, source } = body;

    if (!EMAIL_REGEX.test(email)) {
      return status(400, { success: false, error: 'Email invalide' });
    }

    try {
      const { created } = await waitlistRepository.add(email, source ?? null);

      if (!created) {
        return { success: true, alreadyExists: true };
      }

      logger.info('Waitlist signup', {
        operation: 'waitlist:signup',
        source: source ?? 'unknown',
        severity: 'low' as const,
      });

      return { success: true, alreadyExists: false };
    } catch (error) {
      logger.error('Waitlist signup failed', {
        operation: 'waitlist:signup:error',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return status(500, { success: false, error: 'Erreur serveur' });
    }
  }, {
    body: t.Object({
      email: t.String({ minLength: 1, maxLength: 320, format: 'email' }),
      source: t.Optional(t.String({ maxLength: 100 })),
    }),
  });
