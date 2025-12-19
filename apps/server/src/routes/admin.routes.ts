/**
 * Admin Routes - User Management CRUD
 * 5 routes REST standard sans over-engineering
 */

import { Elysia, t } from 'elysia';
import { auth } from '../lib/auth';
import * as adminService from '../services/admin.service';
import { logger } from '../lib/observability';

/**
 * Middleware admin: vérifie que l'utilisateur a le rôle admin
 * Utilise Better Auth session validation (JWT avec rôle dans claims)
 */
async function requireAdmin({ headers, set }: any) {
  const session = await auth.api.getSession({ headers });

  if (!session || !session.user) {
    set.status = 401;
    throw new Error('Authentication required');
  }

  if (session.user.role !== 'admin') {
    set.status = 403;
    throw new Error('Admin role required');
  }

  return { session };
}

/**
 * Routes admin avec middleware de protection
 */
export const adminRoutes = new Elysia({ prefix: '/admin' })
  .derive(requireAdmin) // Toutes les routes requièrent admin

  // GET /admin/users - Liste utilisateurs (format React Admin)
  .get(
    '/users',
    async ({ query, set }) => {
      logger.info('Admin: List users', { query, operation: 'admin:list-users' });

      const result = await adminService.listUsers(query);

      // React Admin ra-data-simple-rest attend un array + header Content-Range
      const page = query.page || 1;
      const perPage = query.perPage || 25;
      const start = (page - 1) * perPage;
      const end = Math.min(start + result.data.length - 1, result.total - 1);

      set.headers['Content-Range'] = `users ${start}-${end}/${result.total}`;
      set.headers['Access-Control-Expose-Headers'] = 'Content-Range';

      return result.data; // Array direct, pas d'objet wrapper
    },
    {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        perPage: t.Optional(t.Numeric()),
        q: t.Optional(t.String()), // search
        role: t.Optional(t.Union([t.Literal('student'), t.Literal('parent'), t.Literal('admin')])),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )

  // GET /admin/users/:id - Récupère un utilisateur
  .get(
    '/users/:id',
    async ({ params }) => {
      logger.info('Admin: Get user', { userId: params.id, operation: 'admin:get-user' });

      const userData = await adminService.getUserById(params.id);

      return userData;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /admin/users - Crée un utilisateur
  .post(
    '/users',
    async ({ body }) => {
      logger.info('Admin: Create user', { email: body.email, role: body.role, operation: 'admin:create-user' });

      const newUser = await adminService.createUser(body as any); // Type coercion pour éviter union verbose

      return newUser;
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        name: t.String({ minLength: 2 }),
        role: t.Union([t.Literal('student'), t.Literal('parent'), t.Literal('admin')]),
        firstName: t.Optional(t.String()),
        lastName: t.Optional(t.String()),
        schoolLevel: t.Optional(t.String()),
        dateOfBirth: t.Optional(t.String()),
        parentId: t.Optional(t.String()),
      }),
    }
  )

  // PATCH /admin/users/:id - Met à jour un utilisateur
  .patch(
    '/users/:id',
    async ({ params, body }) => {
      logger.info('Admin: Update user', { userId: params.id, operation: 'admin:update-user' });

      const updated = await adminService.updateUser(params.id, body as any); // Type coercion pour éviter union verbose

      return updated;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        email: t.Optional(t.String({ format: 'email' })),
        name: t.Optional(t.String({ minLength: 2 })),
        role: t.Optional(t.Union([t.Literal('student'), t.Literal('parent'), t.Literal('admin')])),
        isActive: t.Optional(t.Boolean()),
        firstName: t.Optional(t.String()),
        lastName: t.Optional(t.String()),
        schoolLevel: t.Optional(t.String()),
        dateOfBirth: t.Optional(t.String()),
        parentId: t.Optional(t.String()),
      }),
    }
  )

  // DELETE /admin/users/:id - Supprime un utilisateur (soft delete, format React Admin)
  .delete(
    '/users/:id',
    async ({ params }) => {
      logger.info('Admin: Delete user', { userId: params.id, operation: 'admin:delete-user' });

      const deleted = await adminService.deleteUser(params.id);

      return deleted; // React Admin attend l'objet user directement
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
