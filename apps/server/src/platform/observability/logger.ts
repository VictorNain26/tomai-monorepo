/**
 * pino, with the request's id on every line (read from the Hono context of the request being
 * served), and an error serializer that keeps no content.
 */

import { DrizzleQueryError } from 'drizzle-orm/errors';
import { tryGetContext } from 'hono/context-storage';
import pino, { type Logger } from 'pino';
import postgres from 'postgres';
import type { LogLevel } from '../../config';
import type { AppEnv } from '../http/env';

/**
 * The database's error messages copy content, a minor's words: the bound values
 * (drizzle-orm 0.45 `DrizzleQueryError`) and a row's values (postgres' own messages).
 */
function contentFreeMessage(error: Error): string | null {
  if (error instanceof DrizzleQueryError) return `Failed query: ${error.query}`;
  if (error instanceof postgres.PostgresError) {
    return [`SQLSTATE ${error.code}`, error.table_name, error.column_name, error.constraint_name].filter(Boolean).join(' ');
  }
  return null;
}

/** The stack's frames, after the message it opens on; none when that message cannot be found. */
function framesAfter(stack: string | undefined, message: string): string {
  const at = stack?.indexOf(message) ?? -1;
  return stack && at >= 0 ? stack.slice(at + message.length) : '';
}

/**
 * Allow-list serializer for `err`: pino's default copies every enumerable property, where a
 * library error can carry a request body.
 */
export function serializeError(value: unknown): unknown {
  if (!(value instanceof Error)) return value;
  const { code } = value as { code?: unknown };
  const contentFree = contentFreeMessage(value);
  return {
    type: value.name,
    message: contentFree ?? value.message,
    stack: contentFree === null ? value.stack : `${value.name}: ${contentFree}${framesAfter(value.stack, value.message)}`,
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
    ...(value.cause === undefined ? {} : { cause: serializeError(value.cause) }),
  };
}

export function createLogger(level: LogLevel, destination?: pino.DestinationStream): Logger {
  return pino(
    {
      level,
      serializers: { err: serializeError },
      // https://github.com/pinojs/pino/blob/main/docs/api.md#mixin-function
      mixin() {
        const c = tryGetContext<AppEnv>();
        return c ? { requestId: c.var.requestId } : {};
      },
    },
    destination,
  );
}
