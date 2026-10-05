import { describe, expect, it } from 'bun:test';
import { tmpdir } from 'node:os';

const MODULE = new URL('../platform/observability/logger.ts', import.meta.url).pathname;

/** Runs `script` with `logger` in scope in a fresh production process and returns the JSON lines it printed. */
function logLines(script: string, env: Record<string, string> = {}): Record<string, unknown>[] {
  const result = Bun.spawnSync(
    ['bun', '--no-env-file', '-e', `const { logger } = await import(${JSON.stringify(MODULE)}); ${script}`],
    {
      cwd: tmpdir(),
      env: { PATH: process.env.PATH ?? '', NODE_ENV: 'production', ...env },
      stderr: 'pipe',
    },
  );
  expect(result.exitCode).toBe(0);
  return result.stdout
    .toString()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('logger', () => {
  it('keeps the message, the context and the level', () => {
    const [line] = logLines(`logger.info('hello', { operation: 'test:op', userId: 'u1' });`);
    expect(line).toMatchObject({ msg: 'hello', operation: 'test:op', userId: 'u1', level: 30 });
  });

  it('serialises an Error with its stack', () => {
    const [line] = logLines(`logger.error('boom', { err: new Error('kaput'), severity: 'high' });`);
    const err = line?.['err'] as { type: string; message: string; stack: string };
    expect(err.type).toBe('Error');
    expect(err.message).toBe('kaput');
    expect(err.stack).toContain('kaput');
  });

  it('never logs other properties of an Error, such as an AI SDK request body', () => {
    const [line] = logLines(`
      const cause = Object.assign(new Error('upstream'), { code: 'ECONNRESET' });
      const e = Object.assign(new Error('call failed', { cause }), {
        statusCode: 503,
        requestBodyValues: { messages: [{ role: 'user', content: 'secret pupil text' }] },
      });
      logger.error('ai', { err: e, severity: 'high' });
    `);
    const err = line?.['err'] as Record<string, unknown>;
    expect(JSON.stringify(line)).not.toContain('secret pupil text');
    expect(err).toMatchObject({ type: 'Error', message: 'call failed', statusCode: 503 });
    expect(err['cause']).toMatchObject({ message: 'upstream', code: 'ECONNRESET' });
  });

  it("logs the AI SDK errors without the model's output, a tool's input or the errors a retry wraps", () => {
    const AI = JSON.stringify(Bun.resolveSync('ai', import.meta.dir));
    const lines = logLines(`
      const { TypeValidationError, JSONParseError, InvalidToolInputError, NoObjectGeneratedError, RetryError } = await import(${AI});
      const invalid = new TypeValidationError({ value: { reply: 'le secret de Léa' }, cause: new Error('Expected string') });
      logger.error('schema', { err: invalid, severity: 'high' });
      logger.error('json', { err: new JSONParseError({ text: '{"reply": "le secret\\n   at la fin, Léa a écrit"', cause: new Error('Unexpected end') }), severity: 'high' });
      logger.error('tool', { err: new InvalidToolInputError({ toolName: 'generate_flashcards', toolInput: 'le secret de Léa', cause: invalid }), severity: 'high' });
      logger.error('object', { err: new NoObjectGeneratedError({ message: 'No object generated: response did not match schema.', text: 'le secret de Léa', cause: invalid, response: {}, usage: {}, finishReason: 'stop' }), severity: 'high' });
      logger.error('retry', { err: new RetryError({ message: 'Failed after 2 attempts. Last error: le secret de Léa', reason: 'maxRetriesExceeded', errors: [new Error('le secret de Léa'), invalid] }), severity: 'high' });
    `);
    expect(JSON.stringify(lines)).not.toContain('secret');
    expect(JSON.stringify(lines)).not.toContain('Léa');
    const errs = lines.map((line) => line['err'] as { type: string; message: string; stack: string; cause?: { message: string } });
    expect(errs.map((err) => err.message)).toEqual([
      'AI_TypeValidationError',
      'AI_JSONParseError',
      'Invalid input for tool generate_flashcards',
      'No object generated: response did not match schema.',
      'Failed after 2 attempts (maxRetriesExceeded)',
    ]);
    expect(errs[0]?.stack).toStartWith('AI_TypeValidationError: AI_TypeValidationError\n    at ');
    expect(errs[0]?.cause?.message).toBe('Expected string');
    expect(errs[4]?.cause?.message).toBe('AI_TypeValidationError');
  });

  it("logs the database's and the Mistral SDK's errors without the bound values or the response body", () => {
    const resolve = (name: string) => JSON.stringify(Bun.resolveSync(name, import.meta.dir));
    const lines = logLines(`
      const { DrizzleQueryError } = await import(${resolve('drizzle-orm/errors')});
      const { default: postgres } = await import(${resolve('postgres')});
      const { MistralError } = await import(${resolve('@mistralai/mistralai/models/errors')});
      const rejected = new postgres.PostgresError({ message: 'invalid input syntax for type uuid: "devoir de Léa"', code: '22P02', table_name: 'study_sessions', detail: 'devoir de Léa' });
      logger.error('db', { err: new DrizzleQueryError('insert into "study_sessions" ("topic") values ($1)', ['devoir de Léa'], rejected), severity: 'high' });
      const response = new Response('{"detail":[{"input":"devoir de Léa"}]}', { status: 422, headers: { 'content-type': 'application/json' } });
      logger.error('mistral', { err: new MistralError('API error occurred: {"detail":[{"input":"devoir de Léa"}]}', { response, request: new Request('https://api.mistral.ai'), body: '{"detail":[{"input":"devoir de Léa"}]}' }), severity: 'high' });
    `);
    expect(JSON.stringify(lines)).not.toContain('Léa');
    const [db, mistral] = lines.map((line) => line['err'] as { message: string; cause?: { message: string; code?: string } });
    expect(db).toMatchObject({ message: 'Failed query: insert into "study_sessions" ("topic") values ($1)', cause: { message: 'SQLSTATE 22P02 study_sessions', code: '22P02' } });
    expect(mistral?.message).toBe('MistralError (HTTP 422)');
  });

  it('does not throw on a BigInt or a circular reference', () => {
    const lines = logLines(
      `const a = {}; a.self = a; logger.info('big', { n: 10n }); logger.info('circular', { a });`,
    );
    expect(lines.map((l) => l['msg'])).toEqual(['big', 'circular']);
  });

  it('applies LOG_LEVEL', () => {
    const lines = logLines(`logger.info('hidden'); logger.warn('shown');`, { LOG_LEVEL: 'warn' });
    expect(lines.map((l) => l['msg'])).toEqual(['shown']);
  });
});
