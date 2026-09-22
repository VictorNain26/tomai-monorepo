/**
 * Authentication Macro for Elysia
 *
 * Idiomatique Elysia pattern pour injecter les contextes user/session typés
 * dans les handlers sans boilerplate `handleAuthWithCookies` répété.
 *
 * Usage:
 * ```ts
 * app.use(authMacro)
 *   .guard({ auth: true })
 *   .get('/protected', ({ user, session }) => {
 *     // user et session sont typés et injectés automatiquement
 *   })
 * ```
 *
 * Pour parent-only routes:
 * ```ts
 * app.use(authMacro)
 *   .guard({ parentAuth: true })
 *   .get('/parent-only', ({ user, session }) => {
 *     // user.role === 'parent' garanti
 *   })
 * ```
 */

import { Elysia } from 'elysia';
import { requireAuth, requireParentRole } from '../middleware/auth.middleware';

export const authMacro = new Elysia({ name: 'auth-macro' }).macro({
  auth: {
    async resolve({ request, status }) {
      const result = await requireAuth(request.headers);
      if (!result.success) return status(result.status);
      return { user: result.user, session: result.session };
    },
  },

  parentAuth: {
    async resolve({ request, status }) {
      const result = await requireParentRole(request.headers);
      if (!result.success) return status(result.status);
      return { user: result.user, session: result.session };
    },
  },
});
