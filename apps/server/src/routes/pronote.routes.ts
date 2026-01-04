/**
 * Pronote Routes - Parent-based connection architecture
 *
 * Parent endpoints: Connect, manage mappings, fetch data for children
 * Student endpoints: Read-only access to their own data via mapping
 */

import { Elysia, t } from 'elysia';
import { auth } from '../lib/auth.js';
import { pronoteService } from '../services/pronote.service.js';
import { logger } from '../lib/observability.js';
import {
  createRateLimitMiddleware,
  RateLimitPresets,
} from '../middleware/rate-limit.middleware.js';

// =============================================
// PARENT ROUTES
// =============================================

export const pronoteParentRoutes = new Elysia({ prefix: '/api/pronote' })
  .derive(async ({ request: { headers }, set }) => {
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      set.status = 401;
      return { parent: null, authError: 'Non authentifié' as const };
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'parent') {
      set.status = 403;
      return { parent: null, authError: 'Réservé aux parents' as const };
    }

    return { parent: session.user, authError: null };
  })

  /**
   * POST /api/pronote/connect
   * Connect parent account with QR code
   */
  .post(
    '/connect',
    async ({ body, parent, authError, set }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const { qrCodeJson, pin, establishmentRne } = body;

      const result = await pronoteService.connectParentWithQrCode(
        parent.id,
        establishmentRne,
        qrCodeJson,
        pin
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      logger.info('Pronote parent connected via API', {
        operation: 'pronote:api:connect',
        parentId: parent.id,
        establishmentRne,
        childrenCount: result.resources?.length ?? 0,
      });

      return {
        success: true,
        establishmentName: result.establishmentName,
        resources: result.resources,
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
        summary: 'Connect parent to Pronote via QR Code',
        description:
          'Authenticate parent with Pronote. Returns list of children for mapping. Rate limited.',
      },
    }
  )

  /**
   * POST /api/pronote/mappings
   * Create child mappings (Pronote child → TomAI child)
   */
  .post(
    '/mappings',
    async ({ body, parent, authError, set }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const result = await pronoteService.createChildMappings(parent.id, body.mappings);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      logger.info('Pronote mappings created via API', {
        operation: 'pronote:api:mappings',
        parentId: parent.id,
        mappingsCount: body.mappings.length,
      });

      return { success: true, message: 'Mappings créés avec succès' };
    },
    {
      body: t.Object({
        mappings: t.Array(
          t.Object({
            childId: t.String({ description: 'TomAI child user ID' }),
            resourceIndex: t.Number({ description: 'Index in Pronote resources array' }),
            pronoteChildName: t.String({ description: 'Child name in Pronote' }),
            pronoteClassName: t.Optional(t.String({ description: 'Class name in Pronote' })),
          })
        ),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Create child mappings',
        description: 'Map Pronote children to TomAI children accounts.',
      },
    }
  )

  /**
   * GET /api/pronote/mappings
   * Get current child mappings
   */
  .get(
    '/mappings',
    async ({ parent, authError }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const mappings = await pronoteService.getChildMappings(parent.id);
      return { mappings };
    },
    {
      detail: {
        tags: ['Pronote'],
        summary: 'Get child mappings',
        description: 'Get current Pronote to TomAI child mappings.',
      },
    }
  )

  /**
   * DELETE /api/pronote/disconnect
   * Disconnect parent from Pronote
   */
  .delete(
    '/disconnect',
    async ({ parent, authError, set }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const success = await pronoteService.disconnectParent(parent.id);

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
        description: 'Remove Pronote connection and all child mappings.',
      },
    }
  )

  /**
   * GET /api/pronote/status
   * Get parent connection status
   */
  .get(
    '/status',
    async ({ parent, authError }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const status = await pronoteService.getParentConnectionStatus(parent.id);
      return status;
    },
    {
      detail: {
        tags: ['Pronote'],
        summary: 'Get parent Pronote connection status',
        description: 'Check if parent is connected to Pronote and get available resources.',
      },
    }
  )

  /**
   * GET /api/pronote/child/:childId/homework
   * Get homework for a specific child
   */
  .get(
    '/child/:childId/homework',
    async ({ params, query, parent, authError, set }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const weekOffset = query.weekOffset ?? 0;
      const homework = await pronoteService.getHomeworkForChild(params.childId, weekOffset);

      if (homework === null) {
        set.status = 400;
        return { error: 'Enfant non mappé ou connexion expirée', reconnectRequired: true };
      }

      return { homework, weekOffset, count: homework.length };
    },
    {
      params: t.Object({ childId: t.String() }),
      query: t.Object({
        weekOffset: t.Optional(t.Number({ description: 'Week offset (0 = this week)' })),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Get homework for child',
        description: 'Retrieve homework assignments for a specific child.',
      },
    }
  )

  /**
   * GET /api/pronote/child/:childId/grades
   * Get grades for a specific child
   */
  .get(
    '/child/:childId/grades',
    async ({ params, parent, authError, set }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const grades = await pronoteService.getGradesForChild(params.childId);

      if (grades === null) {
        set.status = 400;
        return { error: 'Enfant non mappé ou connexion expirée', reconnectRequired: true };
      }

      return { grades, count: grades.length };
    },
    {
      params: t.Object({ childId: t.String() }),
      detail: {
        tags: ['Pronote'],
        summary: 'Get grades for child',
        description: 'Retrieve grades for a specific child.',
      },
    }
  )

  /**
   * GET /api/pronote/child/:childId/timetable
   * Get timetable for a specific child
   */
  .get(
    '/child/:childId/timetable',
    async ({ params, query, parent, authError, set }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const weekOffset = query.weekOffset ?? 0;
      const timetable = await pronoteService.getTimetableForChild(params.childId, weekOffset);

      if (timetable === null) {
        set.status = 400;
        return { error: 'Enfant non mappé ou connexion expirée', reconnectRequired: true };
      }

      return { timetable, weekOffset, count: timetable.length };
    },
    {
      params: t.Object({ childId: t.String() }),
      query: t.Object({
        weekOffset: t.Optional(t.Number({ description: 'Week offset (0 = this week)' })),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Get timetable for child',
        description: 'Retrieve timetable for a specific child.',
      },
    }
  );

// =============================================
// STUDENT ROUTES (read-only via mapping)
// =============================================

export const pronoteStudentRoutes = new Elysia({ prefix: '/api/pronote/student' })
  .derive(async ({ request: { headers }, set }) => {
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      set.status = 401;
      return { student: null, authError: 'Non authentifié' as const };
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'student') {
      set.status = 403;
      return { student: null, authError: 'Réservé aux élèves' as const };
    }

    return { student: session.user, authError: null };
  })

  /**
   * GET /api/pronote/student/status
   * Get student's Pronote connection status (via parent mapping)
   */
  .get(
    '/status',
    async ({ student, authError }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const status = await pronoteService.getChildPronoteStatus(student.id);
      return status;
    },
    {
      detail: {
        tags: ['Pronote'],
        summary: 'Get student Pronote status',
        description: 'Check if student is mapped to Pronote via parent connection.',
      },
    }
  )

  /**
   * GET /api/pronote/student/homework
   * Get homework for authenticated student
   */
  .get(
    '/homework',
    async ({ query, student, authError, set }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const weekOffset = query.weekOffset ?? 0;
      const homework = await pronoteService.getHomeworkForChild(student.id, weekOffset);

      if (homework === null) {
        set.status = 400;
        return { error: 'Pronote non connecté', reconnectRequired: true };
      }

      return { homework, weekOffset, count: homework.length };
    },
    {
      query: t.Object({
        weekOffset: t.Optional(t.Number({ description: 'Week offset (0 = this week)' })),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Get student homework',
        description: 'Retrieve homework for the authenticated student.',
      },
    }
  )

  /**
   * GET /api/pronote/student/grades
   * Get grades for authenticated student
   */
  .get(
    '/grades',
    async ({ student, authError, set }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const grades = await pronoteService.getGradesForChild(student.id);

      if (grades === null) {
        set.status = 400;
        return { error: 'Pronote non connecté', reconnectRequired: true };
      }

      return { grades, count: grades.length };
    },
    {
      detail: {
        tags: ['Pronote'],
        summary: 'Get student grades',
        description: 'Retrieve grades for the authenticated student.',
      },
    }
  )

  /**
   * GET /api/pronote/student/timetable
   * Get timetable for authenticated student
   */
  .get(
    '/timetable',
    async ({ query, student, authError, set }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const weekOffset = query.weekOffset ?? 0;
      const timetable = await pronoteService.getTimetableForChild(student.id, weekOffset);

      if (timetable === null) {
        set.status = 400;
        return { error: 'Pronote non connecté', reconnectRequired: true };
      }

      return { timetable, weekOffset, count: timetable.length };
    },
    {
      query: t.Object({
        weekOffset: t.Optional(t.Number({ description: 'Week offset (0 = this week)' })),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Get student timetable',
        description: 'Retrieve timetable for the authenticated student.',
      },
    }
  );

// Combined routes for app registration
export const pronoteRoutes = new Elysia()
  .use(pronoteParentRoutes)
  .use(pronoteStudentRoutes);
