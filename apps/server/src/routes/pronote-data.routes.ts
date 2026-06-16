/**
 * Pronote Data Routes
 *
 * Server-side Pronote data endpoints — grades, homework, timetable.
 * Authorization: parent↔child verified via parentService.isParentOf().
 *
 * GET  /api/pronote/children/:childId/grades     — caller = child or parent
 * GET  /api/pronote/children/:childId/homework   — caller = child or parent
 * GET  /api/pronote/children/:childId/timetable  — caller = child or parent
 * PUT  /api/pronote/children/:childId/resource   — caller = parent only
 */

import { Elysia, t } from 'elysia';
import { authMacro } from '../lib/auth-macro.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../middleware/rate-limit.middleware.js';
import {
  pronoteDataService,
  PronoteResourceNotMappedError,
  PronoteNotConnectedError,
  PronoteMetadataError,
} from '../services/pronote/pronote-data.service.js';
import { pronoteChildResourcesRepository } from '../db/repositories/pronote-child-resources.repository.js';
import { parentService } from '../services/parent.service.js';
import { PronoteReauthRequired } from '../services/pronote/pawnote-server.adapter.js';

const pronoteDataRateLimit = createRateLimitMiddleware(RateLimitPresets.pronote);

export const pronoteDataRoutes = new Elysia({ name: 'pronote-data-routes' })
  .use(authMacro)
  .guard({ auth: true })
  .onBeforeHandle(pronoteDataRateLimit)
  .group('/api/pronote/children/:childId', (app) => app

    // GET /api/pronote/children/:childId/grades
    .get('/grades', async ({ params, user, status }) => {
      const { childId } = params;

      if (user.id !== childId && !(await parentService.isParentOf(user.id, childId))) {
        return status(403, { error: 'Access denied', code: 'forbidden' });
      }

      try {
        const grades = await pronoteDataService.getGrades(childId);
        return { success: true, data: grades };
      } catch (error) {
        if (error instanceof PronoteResourceNotMappedError) {
          return status(404, { error: error.message, code: 'pronote_resource_not_mapped' });
        }
        if (error instanceof PronoteNotConnectedError) {
          return status(409, { error: error.message, code: 'pronote_not_connected' });
        }
        if (error instanceof PronoteReauthRequired) {
          return status(409, { error: error.message, code: 'pronote_reauth_required' });
        }
        if (error instanceof PronoteMetadataError) {
          return status(500, { error: error.message, code: 'pronote_metadata_invalid' });
        }
        throw error;
      }
    })

    // GET /api/pronote/children/:childId/homework
    .get('/homework', async ({ params, user, status }) => {
      const { childId } = params;

      if (user.id !== childId && !(await parentService.isParentOf(user.id, childId))) {
        return status(403, { error: 'Access denied', code: 'forbidden' });
      }

      try {
        const homework = await pronoteDataService.getHomework(childId);
        return { success: true, data: homework };
      } catch (error) {
        if (error instanceof PronoteResourceNotMappedError) {
          return status(404, { error: error.message, code: 'pronote_resource_not_mapped' });
        }
        if (error instanceof PronoteNotConnectedError) {
          return status(409, { error: error.message, code: 'pronote_not_connected' });
        }
        if (error instanceof PronoteReauthRequired) {
          return status(409, { error: error.message, code: 'pronote_reauth_required' });
        }
        if (error instanceof PronoteMetadataError) {
          return status(500, { error: error.message, code: 'pronote_metadata_invalid' });
        }
        throw error;
      }
    })

    // GET /api/pronote/children/:childId/timetable?day=<ISO date>
    .get('/timetable', async ({ params, query, user, status }) => {
      const { childId } = params;

      if (user.id !== childId && !(await parentService.isParentOf(user.id, childId))) {
        return status(403, { error: 'Access denied', code: 'forbidden' });
      }

      try {
        const timetable = await pronoteDataService.getTimetable(childId, query.day);
        return { success: true, data: timetable };
      } catch (error) {
        if (error instanceof PronoteResourceNotMappedError) {
          return status(404, { error: error.message, code: 'pronote_resource_not_mapped' });
        }
        if (error instanceof PronoteNotConnectedError) {
          return status(409, { error: error.message, code: 'pronote_not_connected' });
        }
        if (error instanceof PronoteReauthRequired) {
          return status(409, { error: error.message, code: 'pronote_reauth_required' });
        }
        if (error instanceof PronoteMetadataError) {
          return status(500, { error: error.message, code: 'pronote_metadata_invalid' });
        }
        throw error;
      }
    }, {
      query: t.Object({ day: t.String() }),
    })

    // PUT /api/pronote/children/:childId/resource — parent only
    .put('/resource', async ({ params, body, user, status }) => {
      const { childId } = params;

      // Child must never configure the mapping — parent only
      if (!(await parentService.isParentOf(user.id, childId))) {
        return status(403, { error: 'Access denied: only a parent can configure the resource mapping', code: 'forbidden' });
      }

      await pronoteChildResourcesRepository.upsertMapping(user.id, childId, body.resourceId);
      return { success: true };
    }, {
      body: t.Object({ resourceId: t.Number() }),
    })
  );
