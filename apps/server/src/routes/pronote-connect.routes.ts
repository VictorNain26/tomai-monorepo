/**
 * Pronote Connect Routes
 *
 * Onboarding endpoints — establishment search, QR code connection.
 *
 * GET  /api/pronote/establishments  — search by geolocation
 */

import { Elysia, t } from 'elysia';
import { authMacro } from '../lib/auth-macro.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../middleware/rate-limit.middleware.js';
import { pawnoteServerAdapter } from '../services/pronote/pawnote-server.adapter.js';

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
  });
