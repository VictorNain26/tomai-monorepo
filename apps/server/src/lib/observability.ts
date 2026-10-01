// Structured logger on pino, behind the app's own call shape:
// logger.info(message, context) instead of pino's (context, message).

import pino from 'pino';
import pretty from 'pino-pretty';

interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ErrorContext extends LogContext {
  /** Serialised by pino's `err` serializer: type, message and stack for an Error. */
  err?: unknown;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

// `bun build --target bun` freezes `process.env.*` at build time, so the
// runtime values are read through Bun.env (env.ts validates LOG_LEVEL).
const isProduction = Bun.env['NODE_ENV'] === 'production';
const requestedLevel = Bun.env['LOG_LEVEL'];
const level: Level = LEVELS.find((l) => l === requestedLevel) ?? 'info';

// pino-pretty as an in-process stream (sync), not a worker-thread transport.
const base = pino(
  { level, serializers: { err: pino.stdSerializers.err } },
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
