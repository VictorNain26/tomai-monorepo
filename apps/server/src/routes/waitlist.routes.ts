/**
 * Waitlist Routes - Public endpoint for landing page email collection
 */

import { Elysia } from 'elysia';
import { db } from '../db/connection.js';
import { waitlistEntries } from '../db/schema.js';
import { logger } from '../lib/observability.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const waitlistRoutes = new Elysia({ name: 'waitlist-routes' })
  .post('/api/waitlist', async ({ body, set }) => {
    const { email, source } = body as { email?: string; source?: string };

    if (!email || !EMAIL_REGEX.test(email)) {
      set.status = 400;
      return { success: false, error: 'Email invalide' };
    }

    try {
      const result = await db
        .insert(waitlistEntries)
        .values({ email: email.toLowerCase().trim(), source: source ?? null })
        .onConflictDoNothing({ target: waitlistEntries.email })
        .returning({ id: waitlistEntries.id });

      if (result.length === 0) {
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
      set.status = 500;
      return { success: false, error: 'Erreur serveur' };
    }
  });
