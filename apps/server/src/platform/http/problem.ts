/**
 * Every error response is an RFC 9457 problem details object, `application/problem+json`, with
 * `code` and `requestId` as extension members (https://www.rfc-editor.org/rfc/rfc9457.html).
 * An unexpected error is logged and answered as INTERNAL_ERROR: its message never leaves the
 * server (OWASP A10:2025, CWE-209).
 */

import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Logger } from 'pino';
import type { AppEnv } from './env';

const PROBLEMS = {
  NOT_FOUND: { status: 404, title: 'Ressource introuvable' },
  INTERNAL_ERROR: { status: 500, title: 'Erreur interne' },
} as const satisfies Record<string, { status: ContentfulStatusCode; title: string }>;

export type ProblemCode = keyof typeof PROBLEMS;

export class Problem extends Error {
  constructor(
    readonly code: ProblemCode,
    readonly detail?: string,
  ) {
    super(detail ?? code);
    this.name = 'Problem';
  }
}

function respond(c: Context<AppEnv>, problem: Problem): Response {
  const { status, title } = PROBLEMS[problem.code];
  const body = {
    type: 'about:blank',
    title,
    status,
    code: problem.code,
    ...(problem.detail === undefined ? {} : { detail: problem.detail }),
    requestId: c.var.requestId,
  };
  return c.json(body, status, { 'Content-Type': 'application/problem+json' });
}

export function problemHandler(logger: Logger): ErrorHandler<AppEnv> {
  return (error, c) => {
    if (error instanceof Problem) return respond(c, error);
    logger.error({ err: error }, 'Unhandled error');
    return respond(c, new Problem('INTERNAL_ERROR'));
  };
}

export const notFound: NotFoundHandler<AppEnv> = (c) => respond(c, new Problem('NOT_FOUND'));
