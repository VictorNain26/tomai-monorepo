/**
 * /api/household: a signed-in guardian manages the students of their household. Every route
 * needs a session, and refuses a student. Of better-auth's own routes, a signed-in student reaches
 * only those in STUDENT_AUTH_PATHS: the rest (update-user…) would let them change what their
 * guardian manages.
 */

import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { schoolLevelSchema } from '../../domain/levels';
import type { Auth } from '../../platform/auth/auth';
import { requireSession, type SessionEnv } from '../../platform/auth/session';
import type { AppEnv } from '../../platform/http/env';
import { Problem } from '../../platform/http/problem';
import { jsonBody } from '../../platform/http/validate';
import type { HouseholdService } from './service';

// From the CP to the terminale and beyond for a student who repeated: five to twenty years old.
const MIN_AGE_YEARS = 5;
const MAX_AGE_YEARS = 20;
const STUDENT_AUTH_PATHS = new Set(['/api/auth/device-pairing/redeem', '/api/auth/get-session', '/api/auth/list-sessions', '/api/auth/sign-out']);

const name = z.string().trim().min(1).max(50);

const birthMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'au format AAAA-MM')
  .refine((month) => {
    const now = new Date();
    const youngest = `${String(now.getUTCFullYear() - MIN_AGE_YEARS)}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const oldest = `${String(now.getUTCFullYear() - MAX_AGE_YEARS)}-01`;
    return month <= youngest && month >= oldest;
  }, 'un âge de 5 à 20 ans');

const newStudent = z.object({ name, level: schoolLevelSchema, birthMonth });
const studentPatch = z
  .object({ name: name.optional(), level: schoolLevelSchema.optional() })
  .refine((patch) => patch.name !== undefined || patch.level !== undefined, 'au moins un champ');

/**
 * Before better-auth's handler: a signed-in student is refused every route but STUDENT_AUTH_PATHS.
 * A link opened on their device, a guardian's confirmation link say, goes to the sign-in page,
 * which says whose the device is; the API and the web share one origin.
 */
export function studentAuthGuard({ auth, service }: { auth: Auth; service: HouseholdService }) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!STUDENT_AUTH_PATHS.has(c.req.path)) {
      const session = await auth.api.getSession({ headers: c.req.raw.headers, query: { disableRefresh: true } });
      if (session && (await service.isStudent(session.user.id))) {
        if (c.req.method === 'GET') return c.redirect('/connexion');
        throw new Problem('FORBIDDEN');
      }
    }
    return next();
  });
}

/** /api/me: who is signed in, and as what; the web picks its home from it. */
export function meRoutes({ auth, service }: { auth: Auth; service: HouseholdService }) {
  return new Hono<SessionEnv>().use(requireSession(auth)).get('/', async (c) => c.json(await service.me(c.var.userId, c.var.userName)));
}

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
    .post('/students/:id/pairing-code', async (c) => c.json(await service.pairingCode(c.var.userId, c.req.param('id')), 201))
    .get('/students/:id/devices', async (c) => c.json(await service.listDevices(c.var.userId, c.req.param('id'))))
    .delete('/students/:id/devices/:deviceId', async (c) => {
      await service.revokeDevice(c.var.userId, c.req.param('id'), c.req.param('deviceId'));
      return c.body(null, 204);
    })
    .delete('/students/:id', async (c) => {
      await service.deleteStudent(c.var.userId, c.req.param('id'));
      return c.body(null, 204);
    });
}
