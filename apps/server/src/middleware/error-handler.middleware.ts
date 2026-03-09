/**
 * Global Error Handler Middleware
 *
 * Catches all unhandled errors and returns a standardized response.
 * Integrates with AppError for typed errors, falls back to 500 for unknown errors.
 */

import { Elysia } from 'elysia';
import { AppError, toErrorResponse } from '../lib/errors.js';
import { logger } from '../lib/observability.js';

export const errorHandlerMiddleware = new Elysia({ name: 'error-handler' })
  .onError(({ error, set, request, store }) => {
    const requestId = (store as { requestId?: string }).requestId;
    const url = new URL(request.url).pathname;

    if (error instanceof AppError) {
      set.status = error.statusCode;

      // Log client errors at warn, server errors at error
      if (error.statusCode >= 500) {
        logger.error(`AppError: ${error.message}`, {
          requestId,
          operation: `error-handler:${error.code}`,
          _error: error.message,
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

      return toErrorResponse(error, requestId);
    }

    // Elysia validation errors (t.Object schema failures)
    if (error instanceof Error && 'code' in error) {
      const elysiaError = error as Error & { code: string; status?: number };
      if (elysiaError.code === 'VALIDATION' || elysiaError.code === 'PARSE') {
        set.status = 400;
        return toErrorResponse(new AppError('VALIDATION_ERROR', error.message), requestId);
      }
      if (elysiaError.code === 'NOT_FOUND') {
        set.status = 404;
        return {
          error: { code: 'NOT_FOUND' as const, message: 'Route introuvable.' },
          ...(requestId && { requestId }),
        };
      }
    }

    // Unknown errors — always log, return generic message
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Unhandled error', {
      requestId,
      operation: 'error-handler:unhandled',
      _error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      severity: 'high' as const,
      url,
    });

    set.status = 500;
    return toErrorResponse(new AppError('INTERNAL_ERROR'), requestId);
  });
