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

// In 6e and 5e, the parent beside the child or not (`domain/levels.ts`): said every time, never assumed.
const newSession = z.object({ accompanied: z.boolean() });

const turnBody = z.object({
  text: z.string().transform(sanitize).pipe(z.string().trim().min(1).max(MAX_CHARS)),
  inputMode: z.enum(['text', 'voice']).default('text'),
});

export function tutorRoutes({ auth, service, logger }: { auth: Auth; service: TutorService; logger: Logger }) {
  return new Hono<SessionEnv>()
    .use(requireSession(auth))
    .post('/', jsonBody(newSession), async (c) => c.json(await service.startSession(c.var.userId, c.req.valid('json').accompanied), 201))
    .get('/', async (c) => c.json(await service.listSessions(c.var.userId)))
    .get('/:id/messages', uuidParam('id'), async (c) => c.json(await service.listMessages(c.var.userId, c.req.valid('param').id)))
    .post('/:id/messages', uuidParam('id'), jsonBody(turnBody), async (c) => {
      const input = c.req.valid('json');
      const opened = await service.openTurn(c.var.userId, c.req.valid('param').id, input);
      return createUIMessageStreamResponse({
        keepAliveMs: KEEP_ALIVE_MS,
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            // Transient: the student reads it while waiting, the conversation never keeps it.
            const { text, cue } = await service.runTurn(opened, input, (step) => {
              writer.write({ type: 'data-step', data: step, transient: true });
            });
            writer.write({ type: 'text-start', id: 'reply' });
            writer.write({ type: 'text-delta', id: 'reply', delta: text });
            writer.write({ type: 'text-end', id: 'reply' });
            // For the parent beside the child, under the reply until the next message: never in the conversation.
            if (cue) writer.write({ type: 'data-cue', data: cue, transient: true });
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

const memoryAnswer = z.object({ answer: z.enum(['accepted', 'declined']) });

/**
 * /api/memory: what Tom keeps of the signed-in student (`docs/etudes/2026-10-07/memoire-entre-seances.md`),
 * their answer to it, and its erasure, all of it or one notion understood.
 */
export function memoryRoutes({ auth, service }: { auth: Auth; service: TutorService }) {
  return new Hono<SessionEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => c.json(await service.memory(c.var.userId)))
    .post('/answer', jsonBody(memoryAnswer), async (c) => {
      await service.answerMemory(c.var.userId, c.req.valid('json').answer);
      return c.json(await service.memory(c.var.userId));
    })
    .delete('/', async (c) => {
      await service.resetMemory(c.var.userId);
      return c.body(null, 204);
    })
    .delete('/notions/:notionId', async (c) => {
      await service.resetNotion(c.var.userId, c.req.param('notionId'));
      return c.body(null, 204);
    });
}

/**
 * /api/summary: the summary of the week (`docs/vision.md`, principle 3), the signed-in student's
 * own, or a student's for a guardian of their household; the same for both.
 */
export function summaryRoutes({ auth, service }: { auth: Auth; service: TutorService }) {
  return new Hono<SessionEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => c.json(await service.summary(c.var.userId)))
    .get('/:studentId', async (c) => c.json(await service.summaryFor(c.var.userId, c.req.param('studentId'))));
}
