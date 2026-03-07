/**
 * Tests unitaires - Education Service (services/education.service.ts)
 * Mock: Qdrant + cache + logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Qdrant mock
let qdrantStats = {
  by_niveau: { troisieme: 100, seconde: 50 } as Record<string, number>,
};
let qdrantMatieres: Record<string, number> = { mathematiques: 80, francais: 60 };
const mockInvalidateCache = mock(() => {});

mock.module('../services/qdrant.service', () => ({
  qdrantService: {
    getStats: mock(async () => qdrantStats),
    getMatieresForNiveau: mock(async () => qdrantMatieres),
    invalidateCache: mockInvalidateCache,
  },
}));

// In-memory cache mock (use real-like behavior)
const cacheStore = new Map<string, unknown>();

mock.module('../services/memory-cache.service', () => ({
  cacheService: {
    get: mock((_ns: string, key: string) => cacheStore.get(key) ?? null),
    set: mock((_ns: string, key: string, data: unknown) => { cacheStore.set(key, data); return true; }),
    delete: mock((_ns: string, key: string) => cacheStore.delete(key)),
    invalidateByPattern: mock((pattern: string) => {
      const prefix = pattern.replace('*', '');
      let count = 0;
      for (const key of cacheStore.keys()) {
        if (key.startsWith(prefix)) { cacheStore.delete(key); count++; }
      }
      return count;
    }),
  },
  memoryCacheService: {
    get: mock((_ns: string, key: string) => cacheStore.get(key) ?? null),
    set: mock((_ns: string, key: string, data: unknown) => { cacheStore.set(key, data); return true; }),
    delete: mock((_ns: string, key: string) => cacheStore.delete(key)),
  },
}));

// Import after mocks
const { educationService } = await import('../services/education.service');

beforeEach(() => {
  cacheStore.clear();
  qdrantStats = { by_niveau: { troisieme: 100, seconde: 50 } };
  qdrantMatieres = { mathematiques: 80, francais: 60 };
});

describe('Education Service', () => {
  describe('getAvailableLevels', () => {
    it('should return all 12 levels with ragAvailable', async () => {
      const levels = await educationService.getAvailableLevels();
      expect(levels.length).toBe(12);
      const troisieme = levels.find(l => l.key === 'troisieme');
      expect(troisieme?.ragAvailable).toBe(true);
      const cp = levels.find(l => l.key === 'cp');
      expect(cp?.ragAvailable).toBe(false);
    });

    it('should return cached result on second call', async () => {
      await educationService.getAvailableLevels();
      // Second call should use cache
      const levels = await educationService.getAvailableLevels();
      expect(levels.length).toBe(12);
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('getSubjectsForLevel', () => {
    it('should return subjects from Qdrant', async () => {
      const subjects = await educationService.getSubjectsForLevel('troisieme');
      expect(subjects.length).toBe(2);
      expect(subjects[0]?.key).toBe('mathematiques');
      expect(subjects[0]?.chunksCount).toBe(80);
    });

    it('should use cache on second call', async () => {
      await educationService.getSubjectsForLevel('troisieme');
      const subjects = await educationService.getSubjectsForLevel('troisieme');
      expect(subjects.length).toBe(2);
    });

    it('should skip cache when skipCache=true', async () => {
      await educationService.getSubjectsForLevel('troisieme', true);
      // No cache set when skipCache
      expect(cacheStore.has('education:subjects:troisieme')).toBe(false);
    });
  });

  describe('invalidateCacheForLevel', () => {
    it('should clear cache for specific level', async () => {
      await educationService.getSubjectsForLevel('troisieme');
      educationService.invalidateCacheForLevel('troisieme');
      expect(cacheStore.has('education:subjects:troisieme')).toBe(false);
      expect(mockInvalidateCache).toHaveBeenCalled();
    });
  });

  describe('invalidateAllCache', () => {
    it('should clear all education cache entries', async () => {
      await educationService.getSubjectsForLevel('troisieme');
      educationService.invalidateAllCache();
      expect(cacheStore.size).toBe(0);
      expect(mockInvalidateCache).toHaveBeenCalled();
    });
  });
});
