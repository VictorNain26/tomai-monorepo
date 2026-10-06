import type { RequestIdVariables } from 'hono/request-id';

/** The Hono environment of every route: what the middlewares of app.ts set. */
export interface AppEnv {
  Variables: RequestIdVariables;
}
