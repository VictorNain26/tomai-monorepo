// Structured logger on pino, behind the app's own call shape:
// logger.info(message, context) instead of pino's (context, message).

import pino from 'pino';
import { InvalidToolInputError, JSONParseError, TypeValidationError } from 'ai';
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
 * AI SDK errors whose message copies the model's output or a tool's input, a minor's words
 * (`@ai-sdk/provider` 4.0.17, `ai` 7.0.107): only what they are is kept.
 */
function contentFreeMessage(error: Error): string | null {
  if (TypeValidationError.isInstance(error)) return 'Type validation failed';
  if (JSONParseError.isInstance(error)) return 'JSON parsing failed';
  if (InvalidToolInputError.isInstance(error)) return `Invalid input for tool ${error.toolName}`;
  return null;
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
  // The stack opens on the message: rebuilt from its frames alone, the content cannot slip through.
  const frames = value.stack?.split('\n').filter((line) => /^\s+at /.test(line)) ?? [];
  return {
    type: value.name,
    message: contentFree ?? value.message,
    stack: contentFree === null ? value.stack : [`${value.name}: ${contentFree}`, ...frames].join('\n'),
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
