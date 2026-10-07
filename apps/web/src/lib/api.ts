/**
 * The server's API, typed by its own contract (`tomai-server/contract`, emitted by the server's
 * `build:types`): no type of the server is written again here.
 */

import { DetailedError, hc, parseResponse } from 'hono/client';
import type { AppType, ProblemCode } from 'tomai-server/contract';
import { z } from 'zod';

export const api = hc<AppType>('/').api;

export { parseResponse };

// The body of a problem response (RFC 9457): read at the boundary, never trusted as typed.
const problemBody = z.object({ code: z.string(), detail: z.string().optional() });

export interface Problem {
  status: number;
  code: ProblemCode | null;
  detail: string | undefined;
}

/** The problem the server answered with; null for a failure without one, the network for instance. */
export function problemOf(error: unknown): Problem | null {
  if (!(error instanceof DetailedError)) return null;
  const detail: unknown = error.detail;
  const data = typeof detail === 'object' && detail !== null && 'data' in detail ? detail.data : undefined;
  const body = problemBody.safeParse(data);
  return {
    status: typeof error.statusCode === 'number' ? error.statusCode : 0,
    code: body.success ? (body.data.code as ProblemCode) : null,
    detail: body.success ? body.data.detail : undefined,
  };
}
