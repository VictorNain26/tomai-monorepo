// Structured logger on pino, behind the app's own call shape:
// logger.info(message, context) instead of pino's (context, message).

import pino from 'pino';
import { AISDKError, InvalidToolInputError, NoObjectGeneratedError, RetryError } from 'ai';
import { MistralError } from '@mistralai/mistralai/models/errors';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import postgres from 'postgres';
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
 * The three boundaries whose error messages copy content, a minor's words: the database (the
 * bound values, drizzle-orm 0.45 `DrizzleQueryError`, and a row's values in postgres' own
 * messages), the AI SDK (the model's output, a tool's input, the errors a retry wraps, ai
 * 7.0.107) and the Mistral SDK (the response body, 2.7.0 `MistralError`). Each keeps what it is.
 */
function contentFreeMessage(error: Error): string | null {
  if (error instanceof DrizzleQueryError) return `Failed query: ${error.query}`;
  if (error instanceof postgres.PostgresError) {
    return [`SQLSTATE ${error.code}`, error.table_name, error.column_name, error.constraint_name].filter(Boolean).join(' ');
  }
  if (error instanceof MistralError) return `${error.name} (HTTP ${String(error.statusCode)})`;
  if (InvalidToolInputError.isInstance(error)) return `Invalid input for tool ${error.toolName}`;
  if (RetryError.isInstance(error)) return `Failed after ${String(error.errors.length)} attempts (${error.reason})`;
  // Its messages are fixed texts; the model's output is in `text`, never logged.
  if (NoObjectGeneratedError.isInstance(error)) return error.message;
  if (AISDKError.isInstance(error)) return error.name;
  return null;
}

/** The stack's frames, after the message it opens on; none when that message cannot be found. */
function framesAfter(stack: string | undefined, message: string): string {
  const at = stack?.indexOf(message) ?? -1;
  return stack && at >= 0 ? stack.slice(at + message.length) : '';
}

/**
 * Allow-list serializer for `err`. pino's default copies every enumerable
 * property, and AI SDK errors carry the whole request body (a minor's
 * conversation, profile, base64 images): only identity and stack are kept.
 */
function serializeError(value: unknown): unknown {
  if (!(value instanceof Error)) return value;
  const { code, statusCode } = value as { code?: unknown; statusCode?: unknown };
  const contentFree = contentFreeMessage(value);
  // A retry wraps its errors without a cause: the last one is the one that ended it.
  const cause = RetryError.isInstance(value) ? value.lastError : value.cause;
  return {
    type: value.name,
    message: contentFree ?? value.message,
    stack: contentFree === null ? value.stack : `${value.name}: ${contentFree}${framesAfter(value.stack, value.message)}`,
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
    ...(typeof statusCode === 'number' ? { statusCode } : {}),
    ...(cause === undefined ? {} : { cause: serializeError(cause) }),
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
