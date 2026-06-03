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

const CLEAR_COOKIE_HEADERS = [
  'better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
  'better-auth.session_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
].join(', ');

export const authMacro = new Elysia({ name: 'auth-macro' }).macro({
  auth: {
    async resolve({ request, set, status }) {
      const result = await requireAuth(request.headers);

      if (!result.success) {
        // Clear cookies si session orpheline détectée
        if (result.shouldClearCookies) {
          set.headers['Set-Cookie'] = CLEAR_COOKIE_HEADERS;
        }

        // Retour d'erreur aborte le handler
        return status(result.status);
      }

      // Retour d'objet injecte les champs dans le contexte
      return {
        user: result.user,
        session: result.session
      };
    }
  },

  parentAuth: {
    async resolve({ request, set, status }) {
      const result = await requireParentRole(request.headers);

      if (!result.success) {
        // Clear cookies si session orpheline détectée
        if (result.shouldClearCookies) {
          set.headers['Set-Cookie'] = CLEAR_COOKIE_HEADERS;
        }

        // Retour d'erreur aborte le handler
        return status(result.status);
      }

      // Retour d'objet injecte les champs dans le contexte
      return {
        user: result.user,
        session: result.session
      };
    }
  }
});
