/**
 * Every error response is an RFC 9457 problem details object, `application/problem+json`, with
 * `code` and `requestId` as extension members (https://www.rfc-editor.org/rfc/rfc9457.html).
 * An unexpected error is logged and answered as INTERNAL_ERROR: its message never leaves the
 * server (OWASP A10:2025, CWE-209).
 */

import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Logger } from 'pino';
import type { AppEnv } from './env';

const PROBLEMS = {
  INVALID_REQUEST: { status: 400, title: 'Requête invalide' },
  UNAUTHENTICATED: { status: 401, title: 'Connexion requise' },
  FORBIDDEN: { status: 403, title: 'Accès refusé' },
  NOT_FOUND: { status: 404, title: 'Ressource introuvable' },
  USERNAME_TAKEN: { status: 409, title: "Nom d'utilisateur déjà pris" },
  RATE_LIMITED: { status: 429, title: 'Trop de requêtes' },
  INTERNAL_ERROR: { status: 500, title: 'Erreur interne' },
} as const satisfies Record<string, { status: ContentfulStatusCode; title: string }>;

// Hono's own middlewares (validators, bodyLimit…) throw an HTTPException with the status it means.
const HTTP_ERROR = 'HTTP_ERROR';

type DeclaredCode = keyof typeof PROBLEMS;

/** The `code` of every problem response; a route throws one of the declared ones. */
type ProblemCode = DeclaredCode | typeof HTTP_ERROR;

export class Problem extends Error {
  constructor(
    readonly code: DeclaredCode,
    readonly detail?: string,
  ) {
    super(detail ?? code);
    this.name = 'Problem';
  }
}

interface Body {
  status: ContentfulStatusCode;
  title: string;
  code: ProblemCode;
  detail?: string;
}

function respond(c: Context<AppEnv>, { status, title, code, detail }: Body): Response {
  const body = { type: 'about:blank', title, status, code, ...(detail === undefined ? {} : { detail }), requestId: c.var.requestId };
  return c.json(body, status, { 'Content-Type': 'application/problem+json' });
}

const fromProblem = (problem: Problem): Body => ({
  ...PROBLEMS[problem.code],
  code: problem.code,
  ...(problem.detail === undefined ? {} : { detail: problem.detail }),
});

export function problemHandler(logger: Logger): ErrorHandler<AppEnv> {
  return (error, c) => {
    if (error instanceof Problem) return respond(c, fromProblem(error));
    if (error instanceof HTTPException && error.status < 500) {
      return respond(c, { status: error.status, title: 'Requête refusée', code: HTTP_ERROR });
    }
    logger.error({ err: error }, 'Unhandled error');
    return respond(c, fromProblem(new Problem('INTERNAL_ERROR')));
  };
}

export const notFound: NotFoundHandler<AppEnv> = (c) => respond(c, fromProblem(new Problem('NOT_FOUND')));
