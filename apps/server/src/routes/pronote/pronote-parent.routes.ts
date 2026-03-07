import { Elysia, t } from 'elysia';
import { auth } from '../../lib/auth.js';
import { pronoteService } from '../../services/pronote.service.js';
import { logger } from '../../lib/observability.js';
import {
  createRateLimitMiddleware,
  RateLimitPresets,
} from '../../middleware/rate-limit.middleware.js';

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

  .post(
    '/connect',
    async ({ body, parent, authError, set }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const { qrCodeJson, pin, establishmentName } = body;

      const result = await pronoteService.connectParentWithQrCode(
        parent.id, establishmentName, qrCodeJson, pin
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      logger.info('Pronote parent connected via API', {
        operation: 'pronote:api:connect',
        parentId: parent.id, establishmentName,
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
        establishmentName: t.String({ minLength: 1, maxLength: 300, description: "Nom de l'établissement" }),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Connect parent to Pronote via QR Code',
        description: 'Authenticate parent with Pronote. Returns list of children for mapping. Rate limited.',
      },
    }
  )

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
        parentId: parent.id, mappingsCount: body.mappings.length,
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
      detail: { tags: ['Pronote'], summary: 'Create child mappings' },
    }
  )

  .get(
    '/mappings',
    async ({ parent, authError }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const mappings = await pronoteService.getChildMappings(parent.id);
      return { mappings };
    },
    { detail: { tags: ['Pronote'], summary: 'Get child mappings' } }
  )

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
    { detail: { tags: ['Pronote'], summary: 'Disconnect from Pronote' } }
  )

  .get(
    '/status',
    async ({ parent, authError }) => {
      if (authError || !parent) {
        return { error: authError ?? 'Non authentifié' };
      }

      const status = await pronoteService.getParentConnectionStatus(parent.id);
      return status;
    },
    { detail: { tags: ['Pronote'], summary: 'Get parent Pronote connection status' } }
  )

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
      query: t.Object({ weekOffset: t.Optional(t.Number()) }),
      detail: { tags: ['Pronote'], summary: 'Get homework for child' },
    }
  )

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
      detail: { tags: ['Pronote'], summary: 'Get grades for child' },
    }
  )

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
      query: t.Object({ weekOffset: t.Optional(t.Number()) }),
      detail: { tags: ['Pronote'], summary: 'Get timetable for child' },
    }
  );
