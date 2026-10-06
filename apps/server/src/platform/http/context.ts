import { zValidator } from '@hono/zod-validator';
import { createMiddleware } from 'hono/factory';
import type { ValidationTargets } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';
import { z, type ZodType } from 'zod';
import { requireAuth, requireParentRole } from '../auth/session.js';
import { AppError, type FieldError } from './errors.js';
import type { AuthenticatedUser } from '../../types/index.js';

export interface AppEnv { Variables: RequestIdVariables }

export interface AuthEnv {
  Variables: RequestIdVariables & {
    user: AuthenticatedUser;
    session: Record<string, unknown>;
  };
}

type AuthResult = Awaited<ReturnType<typeof requireParentRole>>;

function authFailure(status: Exclude<AuthResult, { success: true }>['status']): AppError {
  if (status === 401) return new AppError('UNAUTHORIZED');
  if (status === 403) return new AppError('FORBIDDEN');
  return new AppError('SERVICE_UNAVAILABLE', 'Authentication service error');
}

export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
  const result = await requireAuth(c.req.raw.headers);
  if (!result.success) throw authFailure(result.status);
  c.set('user', result.user);
  c.set('session', result.session);
  await next();
});

export const requireParent = createMiddleware<AuthEnv>(async (c, next) => {
  const result = await requireParentRole(c.req.raw.headers);
  if (!result.success) throw authFailure(result.status);
  c.set('user', result.user);
  c.set('session', result.session);
  await next();
});

const JSON_CONTENT_TYPE = /^application\/([a-z-.]+\+)?json\b/i;

// Validation messages reach the client's forms: Zod's own in French, as the schemas' custom ones are
// (https://zod.dev/error-customization#internationalization). Set here, where every route's validation
// is defined, so it holds before the first request.
z.config(z.locales.fr());

/** One entry per field: an unknown-keys issue names each key, which Zod keeps outside the path. */
function toFieldErrors(location: keyof ValidationTargets, issues: readonly z.core.$ZodIssue[]): FieldError[] {
  return issues.flatMap((issue) => {
    const path = issue.path.map(String);
    const keys = issue.code === 'unrecognized_keys' ? issue.keys.map((key) => [...path, key]) : [path];
    return keys.map((keyPath) => ({ location, path: keyPath.join('.'), code: issue.code, message: issue.message }));
  });
}

/**
 * zValidator that routes failures through the global VALIDATION_ERROR envelope.
 * Hono validates `{}` when a json body arrives without a JSON Content-Type, so
 * that case is rejected here.
 */
export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (target === 'json' && !JSON_CONTENT_TYPE.test(c.req.header('content-type') ?? '')) {
      throw new AppError('VALIDATION_ERROR', 'Expected an application/json body');
    }
    if (!result.success) {
      throw new AppError('VALIDATION_ERROR', result.error.message, toFieldErrors(target, result.error.issues));
    }
  });
