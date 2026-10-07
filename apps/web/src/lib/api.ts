/**
 * The server's API, typed by its own contract (`tomai-server/contract`, emitted by the server's
 * `build:types`): no type of the server is written again here.
 */

import { DetailedError, hc, parseResponse } from 'hono/client';
import type { AppType, ProblemCode } from 'tomai-server/contract';

export const api = hc<AppType>('/').api;

export { parseResponse };

/** Whether the server answered with this problem (RFC 9457, its `code` member); false for a failure without one. */
export function isProblem(error: unknown, code: ProblemCode): boolean {
  if (!(error instanceof DetailedError)) return false;
  const detail: unknown = error.detail;
  const data = typeof detail === 'object' && detail !== null && 'data' in detail ? detail.data : undefined;
  return typeof data === 'object' && data !== null && 'code' in data && data.code === code;
}
