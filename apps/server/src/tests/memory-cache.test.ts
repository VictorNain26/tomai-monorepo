/**
 * Tests unitaires - Memory Cache Service (services/memory-cache.service.ts)
 * Mock: logger uniquement
 */

import { describe, it, expect, beforeEach, mock, afterAll } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// Mock logger before import
const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Import the class to create fresh instances for testing
// The singleton memoryCacheService has side effects (setInterval), so we test via fresh import
const { MemoryCacheService } = await (async () => {
  // Re-import to get the module with mocked logger
  const mod = await import('../services/memory-cache.service');
  // We need the class, but it's not exported. Test via the singleton.
  return { MemoryCacheService: null, service: mod.memoryCacheService };
})();

// Use the singleton for testing (it's already mocked)
const { memoryCacheService: service } = await import('../services/memory-cache.service');

// Clean up between tests
beforeEach(() => {
  service.clear();
});

afterAll(() => {
  service.shutdown();
});

describe('Memory Cache Service', () => {
  describe('get/set', () => {
    it('should return null for missing key', () => {
      expect(service.get('ns:', 'missing')).toBeNull();
    });

    it('should store and retrieve a value', () => {
      service.set('ns:', 'key1', 'value1');
      expect(service.get<string>('ns:', 'key1')).toBe('value1');
    });

    it('should store various types', () => {
      service.set('ns:', 'num', 42);
      service.set('ns:', 'obj', { a: 1, b: 'two' });
      service.set('ns:', 'arr', [1, 2, 3]);
      service.set('ns:', 'bool', true);

      expect(service.get<number>('ns:', 'num')).toBe(42);
      expect(service.get<{ a: number; b: string }>('ns:', 'obj')).toEqual({ a: 1, b: 'two' });
      expect(service.get<number[]>('ns:', 'arr')).toEqual([1, 2, 3]);
      expect(service.get<boolean>('ns:', 'bool')).toBe(true);
    });

    it('should overwrite existing value', () => {
      service.set('ns:', 'key', 'v1');
      service.set('ns:', 'key', 'v2');
      expect(service.get<string>('ns:', 'key')).toBe('v2');
    });
  });

  describe('metrics', () => {
    it('should track hits', () => {
      service.set('ns:', 'k', 'v');
      service.get('ns:', 'k');
      const metrics = service.getMetrics();
      expect(metrics.hits).toBeGreaterThanOrEqual(1);
    });

    it('should track misses', () => {
      service.get('ns:', 'nonexistent');
      const metrics = service.getMetrics();
      expect(metrics.misses).toBeGreaterThanOrEqual(1);
    });

    it('should track sets', () => {
      const before = service.getMetrics().sets;
      service.set('ns:', 'newkey', 'val');
      expect(service.getMetrics().sets).toBe(before + 1);
    });

    it('should track deletes', () => {
      service.set('ns:', 'del', 'val');
      const before = service.getMetrics().deletes;
      service.delete('ns:', 'del');
      expect(service.getMetrics().deletes).toBe(before + 1);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      // Set with 0.1 second TTL
      service.set('ns:', 'expiring', 'value', 0.1);
      expect(service.get<string>('ns:', 'expiring')).toBe('value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(service.get('ns:', 'expiring')).toBeNull();
    });
  });

  describe('namespace isolation', () => {
    it('should isolate values by namespace', () => {
      service.set('auth:', 'token', 'auth-token');
      service.set('cache:', 'token', 'cache-token');

      expect(service.get<string>('auth:', 'token')).toBe('auth-token');
      expect(service.get<string>('cache:', 'token')).toBe('cache-token');
    });
  });

  describe('delete', () => {
    it('should delete existing key and return true', () => {
      service.set('ns:', 'key', 'value');
      expect(service.delete('ns:', 'key')).toBe(true);
      expect(service.get('ns:', 'key')).toBeNull();
    });

    it('should return false for non-existing key', () => {
      expect(service.delete('ns:', 'nope')).toBe(false);
    });
  });

  describe('invalidateByPattern', () => {
    it('should delete all keys matching prefix', () => {
      service.set('edu:', 'levels:all', 'levels');
      service.set('edu:', 'subjects:math', 'math');
      service.set('other:', 'data', 'other');

      const deleted = service.invalidateByPattern('edu:*');
      expect(deleted).toBe(2);
      expect(service.get('edu:', 'levels:all')).toBeNull();
      expect(service.get('edu:', 'subjects:math')).toBeNull();
      expect(service.get<string>('other:', 'data')).toBe('other');
    });

    it('should return 0 when no keys match', () => {
      expect(service.invalidateByPattern('nonexistent:*')).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing, non-expired key', () => {
      service.set('ns:', 'exists', 'value');
      expect(service.has('ns:', 'exists')).toBe(true);
    });

    it('should return false for expired key', async () => {
      service.set('ns:', 'expiring', 'value', 0.1);
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(service.has('ns:', 'expiring')).toBe(false);
    });

    it('should return false for absent key', () => {
      expect(service.has('ns:', 'absent')).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should compute hitRate correctly', () => {
      service.set('ns:', 'k', 'v');
      service.get('ns:', 'k'); // hit
      service.get('ns:', 'missing'); // miss
      const metrics = service.getMetrics();
      expect(metrics.hitRate).toBeGreaterThan(0);
      expect(metrics.hitRate).toBeLessThanOrEqual(1);
    });
  });

  describe('healthCheck', () => {
    it('should always return healthy', () => {
      const result = service.healthCheck();
      expect(result.status).toBe('healthy');
      expect(result.client).toBe('memory');
      expect(result.latency).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      service.set('ns:', 'a', 1);
      service.set('ns:', 'b', 2);
      service.clear();
      expect(service.get('ns:', 'a')).toBeNull();
      expect(service.get('ns:', 'b')).toBeNull();
      expect(service.getMetrics().size).toBe(0);
    });
  });
});
