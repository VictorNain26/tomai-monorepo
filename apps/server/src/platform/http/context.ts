import { zValidator } from '@hono/zod-validator';
import { createMiddleware } from 'hono/factory';
import type { ValidationTargets } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';
import type { ZodType } from 'zod';
import { requireAuth, requireParentRole } from '../auth/session.js';
import { AppError } from './errors.js';
import type { AuthenticatedUser } from '../../types/index.js';

export type AppEnv = { Variables: RequestIdVariables };

export type AuthEnv = {
  Variables: RequestIdVariables & {
    user: AuthenticatedUser;
    session: Record<string, unknown>;
  };
};

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
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.message);
  });
