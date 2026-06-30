import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { subjectProfileService } from '../../services/chat/subject-profile.service.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/observability.js';

const subjectUnion = t.Union([
  t.Literal('mathematiques'),
  t.Literal('francais'),
  t.Literal('langues'),
  t.Literal('sciences'),
  t.Literal('histoire-geo'),
  t.Literal('general'),
]);

export const studentApiRoutes = new Elysia({ name: 'api-student' })
  .use(authMacro)
  .guard({ auth: true })

  .get('/student/memory', async ({ user }) => {
    try {
      const memory = await subjectProfileService.getMemory(user.id);
      return { success: true, memory };
    } catch (_error) {
      logger.error('Student memory retrieval failed', {
        operation: 'api:student:memory:get',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Memory retrieval failed');
    }
  })

  .patch('/student/memory', async ({ user, body }) => {
    try {
      const profile = await subjectProfileService.editMemory(user.id, body.subject, {
        masteryNotes: body.masteryNotes,
        difficulties: body.difficulties,
      });
      return { success: true, profile };
    } catch (_error) {
      logger.error('Student memory edit failed', {
        operation: 'api:student:memory:patch',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Memory edit failed');
    }
  }, {
    body: t.Object({
      subject: subjectUnion,
      masteryNotes: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
      difficulties: t.Optional(t.Array(t.String({ maxLength: 120 }), { maxItems: 50 })),
    }),
  });
