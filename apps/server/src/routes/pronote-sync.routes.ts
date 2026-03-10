/**
 * Pronote Credential Sync Routes
 *
 * Device-first architecture: mobile stores/retrieves encrypted credentials
 * for multi-device sync. Any authenticated user (parent or student) can
 * manage their own Pronote credentials.
 *
 * PUT    /api/pronote/credentials — Upsert credentials
 * GET    /api/pronote/credentials — Fetch decrypted credentials
 * DELETE /api/pronote/credentials — Delete credentials
 */

import { Elysia, t } from 'elysia';
import { handleAuthWithCookies } from '../middleware/auth.middleware.js';
import { pronoteSyncService } from '../services/pronote-sync.service.js';
import { logger } from '../lib/observability.js';

export const pronoteSyncRoutes = new Elysia({ name: 'pronote-sync-routes' })
  .group('/api/pronote', (app) => app

    // PUT /api/pronote/credentials — Upsert
    .put('/credentials', async ({ body, request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const result = await pronoteSyncService.upsertCredentials(
          authContext.user.id,
          body
        );

        if (!result.success) {
          set.status = 400;
          return { success: false, error: result.error };
        }

        return { success: true };
      } catch (error) {
        logger.error('Pronote credentials upsert failed', {
          operation: 'pronote-sync:route:upsert:error',
          userId: authContext.user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });

        set.status = 500;
        return { success: false, error: 'Erreur interne' };
      }
    }, {
      body: t.Object({
        token: t.String({ minLength: 1 }),
        metadata: t.String({ minLength: 2 }),
        tokenExpiresAt: t.String({ minLength: 1 }),
      }),
    })

    // GET /api/pronote/credentials — Fetch
    .get('/credentials', async ({ request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const credentials = await pronoteSyncService.getCredentials(
          authContext.user.id
        );

        if (!credentials) {
          set.status = 404;
          return { success: false, error: 'No Pronote credentials found' };
        }

        return { success: true, data: credentials };
      } catch (error) {
        logger.error('Pronote credentials fetch failed', {
          operation: 'pronote-sync:route:get:error',
          userId: authContext.user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });

        set.status = 500;
        return { success: false, error: 'Erreur interne' };
      }
    })

    // DELETE /api/pronote/credentials — Delete
    .delete('/credentials', async ({ request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        await pronoteSyncService.deleteCredentials(authContext.user.id);
        return { success: true };
      } catch (error) {
        logger.error('Pronote credentials delete failed', {
          operation: 'pronote-sync:route:delete:error',
          userId: authContext.user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });

        set.status = 500;
        return { success: false, error: 'Erreur interne' };
      }
    })
  );
