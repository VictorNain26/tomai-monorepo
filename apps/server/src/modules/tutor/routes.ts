/**
 * /api/sessions: a signed-in student's sessions with the tutor, their messages, and a turn. A
 * turn answers as the AI SDK's UI message stream, which the web's useChat reads; what refuses it
 * (no session, someone else's, a turn already running) stays a problem response, before the stream.
 */

import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { Hono } from 'hono';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { Auth } from '../../platform/auth/auth';
import { requireSession, type SessionEnv } from '../../platform/auth/session';
import { jsonBody, uuidParam } from '../../platform/http/validate';
import { sanitize } from './core/fences';
import type { TutorService } from './service';

// The calls of a turn can leave the connection silent past Bun's idle timeout (30 s, main.ts).
const KEEP_ALIVE_MS = 10_000;
const MAX_CHARS = 4000;

const turnBody = z.object({
  text: z.string().transform(sanitize).pipe(z.string().trim().min(1).max(MAX_CHARS)),
  inputMode: z.enum(['text', 'voice']).default('text'),
});

export function tutorRoutes({ auth, service, logger }: { auth: Auth; service: TutorService; logger: Logger }) {
  return new Hono<SessionEnv>()
    .use(requireSession(auth))
    .post('/', async (c) => c.json(await service.startSession(c.var.userId), 201))
    .get('/', async (c) => c.json(await service.listSessions(c.var.userId)))
    .get('/:id/messages', uuidParam('id'), async (c) => c.json(await service.listMessages(c.var.userId, c.req.valid('param').id)))
    .post('/:id/messages', uuidParam('id'), jsonBody(turnBody), async (c) => {
      const input = c.req.valid('json');
      const opened = await service.openTurn(c.var.userId, c.req.valid('param').id, input);
      return createUIMessageStreamResponse({
        keepAliveMs: KEEP_ALIVE_MS,
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            const text = await service.runTurn(opened, input);
            writer.write({ type: 'text-start', id: 'reply' });
            writer.write({ type: 'text-delta', id: 'reply', delta: text });
            writer.write({ type: 'text-end', id: 'reply' });
          },
          // The internal message never reaches the student.
          onError: (err) => {
            logger.error({ err }, 'Tutor turn failed');
            return "Tom n'a pas pu répondre. Réessaie dans un instant.";
          },
        }),
      });
    });
}
