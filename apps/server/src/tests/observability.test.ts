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
    const err = line?.err as { type: string; message: string; stack: string };
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
    const err = line?.err as Record<string, unknown>;
    expect(JSON.stringify(line)).not.toContain('secret pupil text');
    expect(err).toMatchObject({ type: 'Error', message: 'call failed', statusCode: 503 });
    expect(err.cause).toMatchObject({ message: 'upstream', code: 'ECONNRESET' });
  });

  it('does not throw on a BigInt or a circular reference', () => {
    const lines = logLines(
      `const a = {}; a.self = a; logger.info('big', { n: 10n }); logger.info('circular', { a });`,
    );
    expect(lines.map((l) => l.msg)).toEqual(['big', 'circular']);
  });

  it('applies LOG_LEVEL', () => {
    const lines = logLines(`logger.info('hidden'); logger.warn('shown');`, { LOG_LEVEL: 'warn' });
    expect(lines.map((l) => l.msg)).toEqual(['shown']);
  });
});
