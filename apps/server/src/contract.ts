/**
 * What the web may know of the server: the type of the app, which `hono/client` turns into a
 * typed client, the codes of the problem responses, and the auth plugin better-auth's client infers.
 * The only entry point of `build:types`.
 */

import type { createApp } from './app';
import type { devicePairing } from './platform/auth/pairing';

export type AppType = ReturnType<typeof createApp>;
export type DevicePairing = ReturnType<typeof devicePairing>;
export type { ProblemCode } from './platform/http/problem';
