/**
 * What the web may know of the server: the type of the app, which `hono/client` turns into a
 * typed client, and the codes of the problem responses. The only entry point of `build:types`.
 */

import type { createApp } from './app';

export type AppType = ReturnType<typeof createApp>;
export type { ProblemCode } from './platform/http/problem';
