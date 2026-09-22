/**
 * Request ID Middleware
 *
 * Generates a unique request ID for every incoming request.
 * Used for log correlation and error tracing.
 */

import { Elysia } from 'elysia';

export const REQUEST_ID_HEADER = 'x-request-id';

// onRequest, not derive: parse errors are raised before derive runs and must still carry the id.
export const requestIdMiddleware = new Elysia({ name: 'request-id' })
  .onRequest(({ set }) => {
    set.headers[REQUEST_ID_HEADER] = crypto.randomUUID();
  })
  .derive({ as: 'global' }, ({ set }) => ({
    requestId: String(set.headers[REQUEST_ID_HEADER]),
  }));
