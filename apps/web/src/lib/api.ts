/**
 * The server's API, typed by its own contract (`tomai-server/contract`, emitted by the server's
 * `build:types`): no type of the server is written again here.
 */

import { APICallError } from 'ai';
import { DetailedError, hc, parseResponse } from 'hono/client';
import type { AppType, ProblemCode } from 'tomai-server/contract';

export const api = hc<AppType>('/').api;

export { parseResponse };

// The body of a refusal: from the typed client, or from the chat's transport.
function bodyOf(error: unknown): unknown {
  if (error instanceof DetailedError) {
    const detail: unknown = error.detail;
    return typeof detail === 'object' && detail !== null && 'data' in detail ? detail.data : undefined;
  }
  if (APICallError.isInstance(error) && error.responseBody !== undefined) {
    try {
      return JSON.parse(error.responseBody);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Whether the server answered with this problem (RFC 9457, its `code` member); false for a failure without one. */
export function isProblem(error: unknown, code: ProblemCode): boolean {
  const body = bodyOf(error);
  return typeof body === 'object' && body !== null && 'code' in body && body.code === code;
}
