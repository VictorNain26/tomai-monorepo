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
import { pronoteConnectService } from '../services/pronote/pronote-connect.service.js';
import {
  PronoteNotConnectedError,
  PronoteMetadataError,
} from '../services/pronote/pronote-data.service.js';
import { PronoteReauthRequired } from '../services/pronote/pawnote-server.adapter.js';
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
  });
