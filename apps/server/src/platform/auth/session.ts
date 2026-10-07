/**
 * The signed-in user of a request, read by better-auth from its session cookie on every call:
 * without cookieCache, a revoked session stops at the next request.
 */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../http/env';
import { Problem } from '../http/problem';
import type { Auth } from './auth';

export interface SessionEnv extends AppEnv {
  Variables: AppEnv['Variables'] & { userId: string };
}

export function requireSession(auth: Auth) {
  return createMiddleware<SessionEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw new Problem('UNAUTHENTICATED');
    c.set('userId', session.user.id);
    await next();
  });
}
