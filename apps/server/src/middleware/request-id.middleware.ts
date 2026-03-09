/**
 * Request ID Middleware
 *
 * Generates a unique request ID for every incoming request.
 * Used for log correlation and error tracing.
 */

import { Elysia } from 'elysia';

export const requestIdMiddleware = new Elysia({ name: 'request-id' })
  .derive(() => {
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return { requestId };
  })
  .onAfterHandle(({ requestId, set }) => {
    set.headers['x-request-id'] = requestId;
  });
