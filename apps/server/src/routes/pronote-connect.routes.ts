/**
 * Pronote Connect Routes
 *
 * Onboarding endpoints — establishment search, QR code connection.
 *
 * GET  /api/pronote/establishments  — search by geolocation
 * POST /api/pronote/connect/qr      — QR-code credential capture
 */

import { Elysia, t } from 'elysia';
import { authMacro } from '../lib/auth-macro.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../middleware/rate-limit.middleware.js';
import { pawnoteServerAdapter } from '../services/pronote/pawnote-server.adapter.js';
import {
  pronoteConnectService,
  PronoteCredentialNotFoundError,
  PronoteCredentialForbiddenError,
  type ActivationSelection,
} from '../services/pronote/pronote-connect.service.js';
import {
  PronoteNotConnectedError,
  PronoteMetadataError,
} from '../services/pronote/pronote-data.service.js';
import { PronoteReauthRequired, PronoteUrlNotAllowedError } from '../services/pronote/pawnote-server.adapter.js';
import { logger } from '../lib/observability.js';

const pronoteRateLimit = createRateLimitMiddleware(RateLimitPresets.pronote);

export const pronoteConnectRoutes = new Elysia({ name: 'pronote-connect-routes' })
  .use(authMacro)
  .guard({ auth: true })
  .onBeforeHandle(pronoteRateLimit)

  // GET /api/pronote/establishments?lat=<number>&lng=<number>
  .get('/api/pronote/establishments', async ({ query }) => {
    const establishments = await pawnoteServerAdapter.searchEstablishments(query.lat, query.lng);
    return { success: true, data: establishments };
  }, {
    query: t.Object({
      lat: t.Numeric(),
      lng: t.Numeric(),
    }),
  })

  // POST /api/pronote/connect/qr
  .post('/api/pronote/connect/qr', async ({ body, user, status }) => {
    try {
      const result = await pronoteConnectService.connectQr(user.id, {
        qr: body.qr,
        pin: body.pin,
      });
      logger.info('Pronote QR connect success', {
        operation: 'pronote-connect:qr',
        userId: user.id,
        resourceCount: result.resources.length,
      });
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof PronoteUrlNotAllowedError) {
        return status(400, { error: 'Invalid Pronote URL', code: 'pronote_url_not_allowed' });
      }
      if (error instanceof PronoteReauthRequired) {
        return status(409, { error: 'QR code rejected by Pronote server', code: 'pronote_reauth_required' });
      }
      if (error instanceof PronoteNotConnectedError) {
        return status(409, { error: 'Pronote account not connected', code: 'pronote_not_connected' });
      }
      if (error instanceof PronoteMetadataError) {
        return status(500, { error: 'Pronote metadata invalid', code: 'pronote_metadata_invalid' });
      }
      throw error;
    }
  }, {
    body: t.Object({
      qr: t.Object({
        jeton: t.String(),
        login: t.String(),
        url: t.String(),
      }),
      pin: t.String({ minLength: 4, maxLength: 4 }),
    }),
  })

  // GET /api/pronote/credentials/:id/children
  .get('/api/pronote/credentials/:id/children', async ({ params, user, status }) => {
    try {
      const children = await pronoteConnectService.discover(user.id, params.id);
      return { success: true, data: children };
    } catch (error) {
      if (error instanceof PronoteCredentialNotFoundError) {
        return status(404, { error: 'Pronote credential not found', code: 'pronote_credential_not_found' });
      }
      if (error instanceof PronoteCredentialForbiddenError) {
        return status(403, { error: 'Access denied', code: 'pronote_credential_forbidden' });
      }
      if (error instanceof PronoteNotConnectedError) {
        return status(409, { error: 'Pronote account not connected', code: 'pronote_not_connected' });
      }
      if (error instanceof PronoteMetadataError) {
        return status(500, { error: 'Pronote metadata invalid', code: 'pronote_metadata_invalid' });
      }
      throw error;
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
  })

  // POST /api/pronote/credentials/:id/resync
  .post('/api/pronote/credentials/:id/resync', async ({ params, user, status }) => {
    try {
      const result = await pronoteConnectService.resync(user.id, params.id);
      logger.info('Pronote resync success', {
        operation: 'pronote-connect:resync',
        userId: user.id,
        addedCount: result.added.length,
        stillMappedCount: result.stillMapped.length,
      });
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof PronoteCredentialNotFoundError) {
        return status(404, { error: 'Pronote credential not found', code: 'pronote_credential_not_found' });
      }
      if (error instanceof PronoteCredentialForbiddenError) {
        return status(403, { error: 'Access denied', code: 'pronote_credential_forbidden' });
      }
      if (error instanceof PronoteNotConnectedError) {
        return status(409, { error: 'Pronote account not connected', code: 'pronote_not_connected' });
      }
      if (error instanceof PronoteMetadataError) {
        return status(500, { error: 'Pronote metadata invalid', code: 'pronote_metadata_invalid' });
      }
      throw error;
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
  })

  // POST /api/pronote/credentials/:id/activate
  .post('/api/pronote/credentials/:id/activate', async ({ params, body, user, status }) => {
    try {
      const selections = body.selections as ActivationSelection[];
      const result = await pronoteConnectService.activate(user.id, params.id, selections);
      logger.info('Pronote activate success', {
        operation: 'pronote-connect:activate',
        userId: user.id,
        activatedCount: result.activated.length,
        failedCount: result.failed.length,
      });
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof PronoteCredentialNotFoundError) {
        return status(404, { error: 'Pronote credential not found', code: 'pronote_credential_not_found' });
      }
      if (error instanceof PronoteCredentialForbiddenError) {
        return status(403, { error: 'Access denied', code: 'pronote_credential_forbidden' });
      }
      throw error;
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      selections: t.Array(t.Object({
        resourceId: t.Number(),
        firstName: t.String(),
        lastName: t.String(),
        schoolLevel: t.String(),
        username: t.Optional(t.String({ minLength: 3 })),
        password: t.Optional(t.String({ minLength: 8 })),
        linkToChildId: t.Optional(t.String()),
      })),
    }),
  });
