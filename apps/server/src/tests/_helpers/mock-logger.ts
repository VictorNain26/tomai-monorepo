/**
 * Mock Logger - Shared test helper
 * Matches the signature of lib/observability logger
 */

import { mock } from 'bun:test';

export function createMockLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}
