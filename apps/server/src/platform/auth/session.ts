/**
 * The signed-in user of a request, read by better-auth from its session cookie on every call:
 * without cookieCache, a revoked session stops at the next request. A session used past better-auth's
 * updateAge is extended, and its new cookie goes out with the response, as get-session does.
 */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../http/env';
import { Problem } from '../http/problem';
import type { Auth } from './auth';

export interface SessionEnv extends AppEnv {
  Variables: AppEnv['Variables'] & { userId: string; userName: string };
}

export function requireSession(auth: Auth) {
  return createMiddleware<SessionEnv>(async (c, next) => {
    const { response: session, headers } = await auth.api.getSession({ headers: c.req.raw.headers, returnHeaders: true });
    if (!session) throw new Problem('UNAUTHENTICATED');
    c.set('userId', session.user.id);
    c.set('userName', session.user.name);
    await next();
    for (const cookie of headers.getSetCookie()) c.res.headers.append('Set-Cookie', cookie);
  });
}
