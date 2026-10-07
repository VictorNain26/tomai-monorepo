import { describe, expect, it } from 'bun:test';
import pino from 'pino';
import { serverUrl, testDatabase } from '../../testing/database';
import { createDb } from '../db/client';
import { healthRoutes } from './health';
import { createLifecycle, shutdown } from './shutdown';

const logger = pino({ level: 'silent' });
const { db } = await testDatabase();

describe('health', () => {
  it('is live and ready while the database answers', async () => {
    const health = healthRoutes({ db, lifecycle: createLifecycle(), logger });
    expect((await health.request('/live')).status).toBe(200);
    const ready = await health.request('/ready');
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: 'ready' });
  });

  it('stops being ready while the server drains, and stays live', async () => {
    const lifecycle = createLifecycle();
    lifecycle.draining = true;
    const health = healthRoutes({ db, lifecycle, logger });
    expect((await health.request('/ready')).status).toBe(503);
    expect((await health.request('/live')).status).toBe(200);
  });

  it('stops being ready when the database does not answer, without saying why', async () => {
    const unreachable = createDb(serverUrl('tom_test_missing'), { production: false });
    const res = await healthRoutes({ db: unreachable.db, lifecycle: createLifecycle(), logger }).request('/ready');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'unavailable' });
    await unreachable.close();
  });
});

describe('shutdown', () => {
  it('fails readiness, waits for the probe, stops the server, then closes the resources, and exits 0', async () => {
    const lifecycle = createLifecycle();
    const steps: string[] = [];
    const started = Date.now();
    const code = await shutdown({
      lifecycle,
      stopServer: async () => {
        steps.push(`stop after ${String(Date.now() - started >= 50)}, draining=${String(lifecycle.draining)}`);
      },
      close: [
        async () => {
          steps.push('close');
        },
      ],
      logger,
      drainMs: 50,
      deadlineMs: 1_000,
    });
    expect(code).toBe(0);
    expect(steps).toEqual(['stop after true, draining=true', 'close']);
  });

  it('exits 1 past the deadline', async () => {
    const code = await shutdown({
      lifecycle: createLifecycle(),
      stopServer: () => new Promise(() => undefined),
      close: [],
      logger,
      drainMs: 0,
      deadlineMs: 20,
    });
    expect(code).toBe(1);
  });

  it('closes the resources one after the other, in order: the tasks still need the database', async () => {
    const steps: string[] = [];
    const lifecycle = createLifecycle();
    const code = await shutdown({
      lifecycle,
      stopServer: () => Promise.resolve(),
      close: [
        async () => {
          await Bun.sleep(20);
          steps.push('tasks');
        },
        () => {
          steps.push('database');
          return Promise.resolve();
        },
      ],
      logger: pino({ level: 'silent' }),
      drainMs: 0,
      deadlineMs: 1_000,
    });
    expect(code).toBe(0);
    expect(steps).toEqual(['tasks', 'database']);
  });

  it('exits 1 when a resource fails to close', async () => {
    const code = await shutdown({
      lifecycle: createLifecycle(),
      stopServer: async () => undefined,
      close: [() => Promise.reject(new Error('boom'))],
      logger,
      drainMs: 0,
      deadlineMs: 1_000,
    });
    expect(code).toBe(1);
  });
});
