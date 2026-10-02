// Structured logger on pino, behind the app's own call shape:
// logger.info(message, context) instead of pino's (context, message).

import pino from 'pino';
import pretty from 'pino-pretty';
import { LOG_LEVELS } from './log-levels.js';

interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ErrorContext extends LogContext {
  /** An Error, serialised by serializeError: type, message, stack, code, cause. */
  err?: unknown;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

type Level = (typeof LOG_LEVELS)[number];

// `bun build --target bun` freezes `process.env.*` at build time, so the
// runtime values are read through Bun.env (env.ts validates LOG_LEVEL).
const isProduction = Bun.env.NODE_ENV === 'production';
const requestedLevel = Bun.env.LOG_LEVEL;
const level: Level = LOG_LEVELS.find((l) => l === requestedLevel) ?? 'info';

/**
 * Allow-list serializer for `err`. pino's default copies every enumerable
 * property, and AI SDK errors carry the whole request body (a minor's
 * conversation, profile, base64 images): only identity and stack are kept.
 */
function serializeError(value: unknown): unknown {
  if (!(value instanceof Error)) return value;
  const { code, statusCode } = value as { code?: unknown; statusCode?: unknown };
  return {
    type: value.name,
    message: value.message,
    stack: value.stack,
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
    ...(typeof statusCode === 'number' ? { statusCode } : {}),
    ...(value.cause === undefined ? {} : { cause: serializeError(value.cause) }),
  };
}

// pino-pretty as an in-process stream (sync), not a worker-thread transport.
const base = pino(
  { level, serializers: { err: serializeError } },
  isProduction ? undefined : pretty({ sync: true, colorize: true, ignore: 'pid,hostname' }),
);

export const logger = {
  debug(message: string, context?: LogContext): void {
    base.debug(context ?? {}, message);
  },
  info(message: string, context?: LogContext): void {
    base.info(context ?? {}, message);
  },
  warn(message: string, context?: LogContext): void {
    base.warn(context ?? {}, message);
  },
  error(message: string, context?: ErrorContext): void {
    base.error(context ?? {}, message);
  },
};
