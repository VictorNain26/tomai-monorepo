import { describe, it, expect, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));

const { createGracefulShutdown } = await import('../lib/graceful-shutdown');

describe('createGracefulShutdown', () => {
  it('awaits each step in order, then exits 0', async () => {
    const calls: string[] = [];
    const shutdown = createGracefulShutdown(
      [
        { name: 'app.stop', run: async () => { await Bun.sleep(5); calls.push('app.stop'); } },
        { name: 'otel', run: async () => { calls.push('otel'); } },
        { name: 'sentry', run: async () => { calls.push('sentry'); return true; } },
        { name: 'db', run: async () => { calls.push('db'); } },
      ],
      (code) => { calls.push(`exit:${code}`); },
    );

    await shutdown('SIGTERM');

    expect(calls).toEqual(['app.stop', 'otel', 'sentry', 'db', 'exit:0']);
  });

  it('runs the remaining steps when one throws', async () => {
    const calls: string[] = [];
    const shutdown = createGracefulShutdown(
      [
        { name: 'app.stop', run: () => { throw new Error('not running'); } },
        { name: 'db', run: async () => { calls.push('db'); } },
      ],
      (code) => { calls.push(`exit:${code}`); },
    );

    await shutdown('SIGTERM');

    expect(calls).toEqual(['db', 'exit:0']);
  });

  it('ignores a second signal received during shutdown', async () => {
    let runs = 0;
    const exit = mock((_code: number) => {});
    const shutdown = createGracefulShutdown(
      [{ name: 'slow', run: async () => { runs++; await Bun.sleep(5); } }],
      exit,
    );

    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);

    expect(runs).toBe(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
