/**
 * Global error handling: every error leaves as `{ error: { code, message }, requestId }`.
 * AppError keeps its status; anything else is logged and answered with a generic 500.
 */

import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AppError, toErrorResponse } from './errors.js';
import { logger } from '../observability/logger.js';
import type { AppEnv } from './context.js';

export const handleError: ErrorHandler<AppEnv> = (error, c) => {
  const requestId = c.get('requestId');
  const url = new URL(c.req.url).pathname;

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(`AppError: ${error.message}`, {
        requestId,
        operation: `error-handler:${error.code}`,
        err: error,
        severity: 'high' as const,
        url,
      });
    } else {
      logger.warn(`AppError: ${error.code}`, {
        requestId,
        operation: `error-handler:${error.code}`,
        url,
      });
    }
    return c.json(toErrorResponse(error, requestId), error.statusCode);
  }

  // Malformed JSON and other request errors raised by Hono itself
  if (error instanceof HTTPException && error.status === 400) {
    return c.json(toErrorResponse(new AppError('VALIDATION_ERROR', error.message), requestId), 400);
  }

  logger.error('Unhandled error', {
    requestId,
    operation: 'error-handler:unhandled',
    err: error,
    severity: 'high' as const,
    url,
  });
  return c.json(toErrorResponse(new AppError('INTERNAL_ERROR'), requestId), 500);
};

export const handleNotFound: NotFoundHandler<AppEnv> = (c) => {
  const requestId = c.get('requestId');
  return c.json(
    { error: { code: 'NOT_FOUND' as const, message: 'Route introuvable.' }, ...(requestId && { requestId }) },
    404,
  );
};
