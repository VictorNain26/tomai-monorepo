import { Hono } from 'hono';
import { z } from 'zod';
import { requireUser, validate, type AppEnv } from '../../platform/http/context.js';
import { subjectProfileService, STUDENT_SUBJECTS } from '../../modules/tutor/index.js';
import { AppError } from '../../platform/http/errors.js';
import { logger } from '../../platform/observability/logger.js';

const editMemoryBody = z.object({
  subject: z.enum(STUDENT_SUBJECTS),
  masteryNotes: z.string().max(500).nullable().optional(),
  difficulties: z.array(z.string().max(120)).max(50).optional(),
});

export const studentApiRoutes = new Hono<AppEnv>()

  .get('/student/memory', requireUser, async (c) => {
    const user = c.var.user;
    try {
      const memory = await subjectProfileService.getMemory(user.id);
      return c.json({ success: true, memory });
    } catch (_error) {
      logger.error('Student memory retrieval failed', {
        operation: 'api:student:memory:get',
        userId: user.id,
        err: _error,
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Memory retrieval failed');
    }
  })

  .patch('/student/memory', requireUser, validate('json', editMemoryBody), async (c) => {
    const user = c.var.user;
    const body = c.req.valid('json');
    try {
      const profile = await subjectProfileService.editMemory(user.id, body.subject, {
        masteryNotes: body.masteryNotes,
        difficulties: body.difficulties,
      });
      if (!profile) {
        return c.json({ success: false as const, error: 'Profil introuvable pour cette matière' }, 404);
      }
      return c.json({ success: true as const, profile });
    } catch (_error) {
      logger.error('Student memory edit failed', {
        operation: 'api:student:memory:patch',
        userId: user.id,
        err: _error,
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Memory edit failed');
    }
  });
