/**
 * Pronote credential management routes (server-only Pronote, QR onboarding).
 *
 * GET    /api/pronote/credentials/list — Credential summaries of the authenticated user
 * DELETE /api/pronote/credentials/:id  — Remove one establishment's credential (children kept)
 */

import { Elysia, t } from 'elysia';
import { authMacro } from '../lib/auth-macro.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../middleware/rate-limit.middleware.js';
import { pronoteSyncService, PronoteCredentialForbiddenError } from '../services/pronote-sync.service.js';
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

    // DELETE /api/pronote/credentials/:id — Delete a single establishment's credential
    // Child user accounts are preserved; only the Pronote link (credential + mappings) is removed.
    .delete('/credentials/:id', async ({ params, user, status }) => {
      try {
        const deleted = await pronoteSyncService.deleteCredentialById(user.id, params.id);
        if (!deleted) {
          return status(404, { error: 'Pronote credential not found', code: 'pronote_credential_not_found' });
        }
        return { success: true };
      } catch (error) {
        if (error instanceof PronoteCredentialForbiddenError) {
          return status(403, { error: 'Access denied', code: 'pronote_credential_forbidden' });
        }
        logger.error('Pronote credential delete by id failed', {
          operation: 'pronote-sync:route:delete-by-id:error',
          userId: user.id,
          credentialId: params.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const,
        });
        return status(500, { success: false, error: 'Erreur interne' });
      }
    }, {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
    })
  );
