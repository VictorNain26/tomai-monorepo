/**
 * Pronote Routes - API endpoints for Pronote integration
 *
 * All endpoints require authentication (student role only).
 * QR Code authentication bypasses ENT/CAS complexity.
 */

import { Elysia, t } from 'elysia';
import { auth } from '../lib/auth.js';
import { pronoteService } from '../services/pronote.service.js';
import { logger } from '../lib/observability.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../middleware/rate-limit.middleware.js';

export const pronoteRoutes = new Elysia({ prefix: '/api/pronote' })
  // =============================================
  // Derive: Add authenticated student to context
  // =============================================
  .derive(async ({ request: { headers }, set }) => {
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      set.status = 401;
      return { student: null, authError: 'Non authentifié' as const };
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'student') {
      set.status = 403;
      return { student: null, authError: 'Seuls les élèves peuvent accéder à Pronote' as const };
    }

    return { student: session.user, authError: null };
  })

  // =============================================
  // CONNECTION MANAGEMENT
  // =============================================

  /**
   * POST /api/pronote/connect
   * Connect to Pronote using QR code
   * SECURITY: Strict rate limiting (5 req/15min per user)
   */
  .post(
    '/connect',
    async ({ body, student, authError, set }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const { qrCodeJson, pin, establishmentRne } = body;

      const result = await pronoteService.connectWithQrCode(
        student.id,
        establishmentRne,
        qrCodeJson,
        pin
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      logger.info('Pronote connected via API', {
        operation: 'pronote:api:connect',
        userId: student.id,
        establishmentRne,
      });

      return {
        success: true,
        establishmentName: result.establishmentName,
        message: 'Connexion Pronote réussie',
      };
    },
    {
      beforeHandle: createRateLimitMiddleware(RateLimitPresets.pronote),
      body: t.Object({
        qrCodeJson: t.String({ description: 'QR code JSON data from Pronote' }),
        pin: t.String({ minLength: 4, maxLength: 4, description: '4-digit PIN code' }),
        establishmentRne: t.String({ minLength: 8, maxLength: 8, description: 'RNE code' }),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Connect to Pronote via QR Code',
        description: 'Authenticate with Pronote using QR code and PIN. Student role required. Rate limited to 5 attempts per 15 minutes.',
      },
    }
  )

  /**
   * DELETE /api/pronote/disconnect
   * Disconnect from Pronote
   */
  .delete(
    '/disconnect',
    async ({ student, authError, set }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const success = await pronoteService.disconnect(student.id);

      if (!success) {
        set.status = 500;
        return { error: 'Échec de la déconnexion' };
      }

      return { success: true, message: 'Déconnexion Pronote réussie' };
    },
    {
      detail: {
        tags: ['Pronote'],
        summary: 'Disconnect from Pronote',
        description: 'Remove Pronote connection and delete stored tokens.',
      },
    }
  )

  /**
   * GET /api/pronote/status
   * Get connection status
   */
  .get(
    '/status',
    async ({ student, authError }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const status = await pronoteService.getConnectionStatus(student.id);

      return status;
    },
    {
      detail: {
        tags: ['Pronote'],
        summary: 'Get Pronote connection status',
        description: 'Check if student is connected to Pronote and get sync info.',
      },
    }
  )

  // =============================================
  // DATA ENDPOINTS
  // =============================================

  /**
   * GET /api/pronote/homework
   * Get homework assignments
   */
  .get(
    '/homework',
    async ({ query, student, authError, set }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const weekOffset = query.weekOffset ?? 0;
      const homework = await pronoteService.getHomework(student.id, weekOffset);

      if (homework === null) {
        set.status = 400;
        return {
          error: 'Non connecté à Pronote',
          reconnectRequired: true,
        };
      }

      return {
        homework,
        weekOffset,
        count: homework.length,
      };
    },
    {
      query: t.Object({
        weekOffset: t.Optional(t.Number({ description: 'Week offset from current (0 = this week)' })),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Get homework assignments',
        description: 'Retrieve homework for the specified week.',
      },
    }
  )

  /**
   * GET /api/pronote/grades
   * Get grades for current period
   */
  .get(
    '/grades',
    async ({ student, authError, set }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const grades = await pronoteService.getGrades(student.id);

      if (grades === null) {
        set.status = 400;
        return {
          error: 'Non connecté à Pronote',
          reconnectRequired: true,
        };
      }

      return {
        grades,
        count: grades.length,
      };
    },
    {
      detail: {
        tags: ['Pronote'],
        summary: 'Get grades',
        description: 'Retrieve grades for the current period.',
      },
    }
  )

  /**
   * GET /api/pronote/timetable
   * Get timetable for the week
   */
  .get(
    '/timetable',
    async ({ query, student, authError, set }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const weekOffset = query.weekOffset ?? 0;
      const timetable = await pronoteService.getTimetable(student.id, weekOffset);

      if (timetable === null) {
        set.status = 400;
        return {
          error: 'Non connecté à Pronote',
          reconnectRequired: true,
        };
      }

      return {
        timetable,
        weekOffset,
        count: timetable.length,
      };
    },
    {
      query: t.Object({
        weekOffset: t.Optional(t.Number({ description: 'Week offset from current (0 = this week)' })),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Get timetable',
        description: 'Retrieve timetable for the specified week.',
      },
    }
  );
