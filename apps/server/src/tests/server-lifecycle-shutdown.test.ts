/**
 * Vérifie que server-lifecycle expose un arrêt des intervals (scheduler de
 * rétention + cron de reset tokens) appelable au shutdown.
 */
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

const stopRetention = mock(() => {});
mock.module('../services/retention-purge.service', () => ({
  startRetentionPurgeScheduler: mock(() => stopRetention),
}));

mock.module('../config/env', () => ({ env: { NODE_ENV: 'test' } }));
mock.module('../db/connection', () => ({
  db: { execute: mock(() => Promise.resolve([{ count: 0 }])) },
}));
mock.module('drizzle-orm', () => ({ sql: (s: unknown) => s }));
mock.module('../lib/encryption', () => ({ validateEncryptionSetup: mock(() => Promise.resolve(true)) }));
mock.module('../middleware/memory-monitor.middleware', () => ({
  memoryMonitor: { startMonitoring: mock(() => {}), stopMonitoring: mock(() => {}) },
}));
mock.module('../services/token-quota.service', () => ({
  tokenQuotaService: { resetAllDailyTokens: mock(() => Promise.resolve({ resetCount: 0 })) },
}));

const { startTokenResetCron, initializeServices, stopBackgroundJobs } = await import(
  '../services/server-lifecycle'
);

beforeEach(() => {
  stopRetention.mockClear();
});

describe('server-lifecycle background jobs', () => {
  it('stopBackgroundJobs clears the token reset cron without throwing', () => {
    startTokenResetCron();
    expect(() => stopBackgroundJobs()).not.toThrow();
  });

  it('stopBackgroundJobs calls the retention stop-fn exactly once', async () => {
    // initializeServices is the only path that sets the module-level stopRetentionPurge
    // variable (via startRetentionPurgeScheduler). Without calling it, stopBackgroundJobs
    // never reaches the retention branch — so this test would be RED if that call were removed.
    await initializeServices();
    stopBackgroundJobs();
    expect(stopRetention).toHaveBeenCalledTimes(1);
  });

  it('stopBackgroundJobs is idempotent (safe to call twice)', async () => {
    await initializeServices();
    stopBackgroundJobs();
    expect(() => stopBackgroundJobs()).not.toThrow();
  });
});
