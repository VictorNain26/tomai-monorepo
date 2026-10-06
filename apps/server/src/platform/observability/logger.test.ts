import { describe, expect, it } from 'bun:test';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { requestId } from 'hono/request-id';
import postgres from 'postgres';
import type { AppEnv } from '../http/env';
import { createLogger, serializeError } from './logger';

function capture() {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger('info', { write: (line: string) => lines.push(JSON.parse(line) as Record<string, unknown>) });
  return { logger, lines };
}

describe('serializeError', () => {
  it('keeps the query of a failed one, never its bound values', () => {
    const error = new DrizzleQueryError('insert into "message" ("text") values ($1)', ['je suis nul en maths'], new Error('boom'));
    expect(serializeError(error)).toMatchObject({ message: 'Failed query: insert into "message" ("text") values ($1)' });
    expect(JSON.stringify(serializeError(error))).not.toContain('je suis nul en maths');
  });

  it("keeps the SQLSTATE and the table of a database error, never the row's values", () => {
    const error = Object.assign(new postgres.PostgresError('duplicate key value violates unique constraint'), {
      code: '23505',
      table_name: 'user',
      constraint_name: 'user_email_unique',
      detail: 'Key (email)=(lea@example.com) already exists.',
    });
    const serialized = JSON.stringify(serializeError(error));
    expect(serialized).toContain('SQLSTATE 23505 user user_email_unique');
    expect(serialized).not.toContain('lea@example.com');
  });

  it('copies only the type, message, stack, code and cause of other errors', () => {
    const error = Object.assign(new Error('outer', { cause: new Error('inner') }), { code: 'E1', body: { secret: 'x' } });
    expect(serializeError(error)).toEqual({
      type: 'Error',
      message: 'outer',
      stack: error.stack,
      code: 'E1',
      cause: { type: 'Error', message: 'inner', stack: (error.cause as Error).stack },
    });
  });
});

describe('createLogger', () => {
  it("adds the request's id to a line written while it is served", async () => {
    const { logger, lines } = capture();
    const app = new Hono<AppEnv>()
      .use(contextStorage())
      .use(requestId())
      .get('/', (c) => {
        logger.info('inside');
        return c.text(c.var.requestId);
      });

    const id = await (await app.request('/')).text();
    logger.info('outside');

    expect(lines[0]).toMatchObject({ msg: 'inside', requestId: id });
    expect(lines[1]).not.toHaveProperty('requestId');
  });
});
