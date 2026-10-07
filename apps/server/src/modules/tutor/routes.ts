/** /api/sessions: a signed-in student's sessions with the tutor, and their messages. */

import { Hono } from 'hono';
import type { Auth } from '../../platform/auth/auth';
import { requireSession, type SessionEnv } from '../../platform/auth/session';
import { uuidParam } from '../../platform/http/validate';
import type { TutorService } from './service';

export function tutorRoutes({ auth, service }: { auth: Auth; service: TutorService }) {
  return new Hono<SessionEnv>()
    .use(requireSession(auth))
    .post('/', async (c) => c.json(await service.startSession(c.var.userId), 201))
    .get('/', async (c) => c.json(await service.listSessions(c.var.userId)))
    .get('/:id/messages', uuidParam('id'), async (c) => c.json(await service.listMessages(c.var.userId, c.req.valid('param').id)));
}
