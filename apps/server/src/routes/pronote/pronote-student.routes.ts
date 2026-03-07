import { Elysia, t } from 'elysia';
import { auth } from '../../lib/auth.js';
import { pronoteService } from '../../services/pronote.service.js';

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

  .get(
    '/status',
    async ({ student, authError }) => {
      if (authError || !student) {
        return { error: authError ?? 'Non authentifié' };
      }

      const status = await pronoteService.getChildPronoteStatus(student.id);
      return status;
    },
    { detail: { tags: ['Pronote'], summary: 'Get student Pronote status' } }
  )

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
      query: t.Object({ weekOffset: t.Optional(t.Number()) }),
      detail: { tags: ['Pronote'], summary: 'Get student homework' },
    }
  )

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
    { detail: { tags: ['Pronote'], summary: 'Get student grades' } }
  )

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
      query: t.Object({ weekOffset: t.Optional(t.Number()) }),
      detail: { tags: ['Pronote'], summary: 'Get student timetable' },
    }
  );
