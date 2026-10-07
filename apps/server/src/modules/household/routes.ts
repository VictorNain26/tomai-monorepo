/**
 * /api/household: a signed-in guardian manages the students of their household. Every route
 * needs a session, and refuses a student.
 */

import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { schoolLevelSchema } from '../../domain/levels';
import type { Auth } from '../../platform/auth/auth';
import { requireSession, type SessionEnv } from '../../platform/auth/session';
import { jsonBody } from '../../platform/http/validate';
import type { HouseholdService } from './service';

const MAX_AGE_YEARS = 20;

const name = z.string().trim().min(1).max(50);
// better-auth's limits: a password it would refuse at sign-in is refused here.
const password = z.string().min(8).max(128);
// Within the username plugin's own rules (3 to 30 of [a-zA-Z0-9_.]).
const username = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_.]+$/, 'lettres, chiffres, point et tiret bas seulement');

const birthMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'au format AAAA-MM')
  .refine((month) => {
    const now = new Date();
    const current = `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const oldest = `${String(now.getUTCFullYear() - MAX_AGE_YEARS)}-01`;
    return month <= current && month >= oldest;
  }, 'un mois passé, de moins de 20 ans');

const newStudent = z.object({ name, username, password, level: schoolLevelSchema, birthMonth });
const studentPatch = z
  .object({ name: name.optional(), level: schoolLevelSchema.optional() })
  .refine((patch) => patch.name !== undefined || patch.level !== undefined, 'au moins un champ');

export function householdRoutes({ auth, service }: { auth: Auth; service: HouseholdService }) {
  const guardianOnly = createMiddleware<SessionEnv>(async (c, next) => {
    await service.assertNotStudent(c.var.userId);
    await next();
  });

  return new Hono<SessionEnv>()
    .use(requireSession(auth), guardianOnly)
    .get('/students', async (c) => c.json(await service.listStudents(c.var.userId)))
    .post('/students', jsonBody(newStudent), async (c) => c.json(await service.createStudent(c.var.userId, c.req.valid('json')), 201))
    .patch('/students/:id', jsonBody(studentPatch), async (c) =>
      c.json(await service.updateStudent(c.var.userId, c.req.param('id'), c.req.valid('json'))),
    )
    .put('/students/:id/password', jsonBody(z.object({ password })), async (c) => {
      await service.setStudentPassword(c.var.userId, c.req.param('id'), c.req.valid('json').password);
      return c.body(null, 204);
    })
    .delete('/students/:id', async (c) => {
      await service.deleteStudent(c.var.userId, c.req.param('id'));
      return c.body(null, 204);
    });
}
