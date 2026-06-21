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
import { authMacro } from '../lib/auth-macro.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../middleware/rate-limit.middleware.js';
import { pronoteSyncService } from '../services/pronote-sync.service.js';
import type { PronoteCredentialSummary } from '../services/pronote-sync.service.js';
import { logger } from '../lib/observability.js';

// Pronote credential endpoints trigger PBKDF2 (600K iterations) on decrypt,
// so we apply a stricter rate-limit than the global API preset.
const pronoteRateLimit = createRateLimitMiddleware(RateLimitPresets.pronote);

export const pronoteSyncRoutes = new Elysia({ name: 'pronote-sync-routes' })
  .use(authMacro)
  // Rate-limit AFTER the auth guard so `resolve` has injected `user` — the
  // pronote preset keys by user id, undefined if this runs before the guard.
  .guard({ auth: true })
  .onBeforeHandle(pronoteRateLimit)
  .group('/api/pronote', (app) => app

    // GET /api/pronote/credentials/list — List all credential summaries for the authenticated user
    .get('/credentials/list', async ({ user, status }) => {
      try {
        const data: PronoteCredentialSummary[] = await pronoteSyncService.listCredentialSummaries(user.id);
        return { success: true, data };
      } catch (error) {
        logger.error('Pronote credentials list failed', {
          operation: 'pronote-sync:route:list:error',
          userId: user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        return status(500, { success: false, error: 'Erreur interne' });
      }
    })

    // PUT /api/pronote/credentials — Upsert
    .put('/credentials', async ({ body, user, status }) => {
      try {
        const result = await pronoteSyncService.upsertCredentials(
          user.id,
          body
        );

        if (!result.success) {
          return status(400, { success: false, error: result.error });
        }

        return { success: true };
      } catch (error) {
        logger.error('Pronote credentials upsert failed', {
          operation: 'pronote-sync:route:upsert:error',
          userId: user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });

        return status(500, { success: false, error: 'Erreur interne' });
      }
    }, {
      body: t.Object({
        token: t.String({ minLength: 1 }),
        metadata: t.String({ minLength: 2 }),
        tokenExpiresAt: t.String({ minLength: 1 }),
      }),
    })

    // GET /api/pronote/credentials — Fetch
    .get('/credentials', async ({ user, status }) => {
      try {
        const credentials = await pronoteSyncService.getCredentials(
          user.id
        );

        if (!credentials) {
          return status(404, { success: false, error: 'No Pronote credentials found' });
        }

        return { success: true, data: credentials };
      } catch (error) {
        logger.error('Pronote credentials fetch failed', {
          operation: 'pronote-sync:route:get:error',
          userId: user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });

        return status(500, { success: false, error: 'Erreur interne' });
      }
    })

    // DELETE /api/pronote/credentials — Delete
    .delete('/credentials', async ({ user, status }) => {
      try {
        await pronoteSyncService.deleteCredentials(user.id);
        return { success: true };
      } catch (error) {
        logger.error('Pronote credentials delete failed', {
          operation: 'pronote-sync:route:delete:error',
          userId: user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });

        return status(500, { success: false, error: 'Erreur interne' });
      }
    })
  );
