/**
 * Tests unitaires - Cognitive Profile Service (modules/tutor/cognitive-profile.service.ts)
 * Mock: DB + logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeCognitiveProfile } from './_helpers/fixtures';

// ============================================
// TYPES
// ============================================

interface CognitiveProfileData {
  id: string;
  userId: string;
  strengths: string[];
  weaknesses: string[];
  observations: { date: string; observation: string; subject?: string }[];
  lastUpdatedByAgent: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

// DB mock state
let queryFindFirstResult: CognitiveProfileData | undefined = undefined;
let dbUpdateCalled = false;
let dbInsertCalled = false;
let dbShouldThrow = false;
let dbWriteShouldThrow = false;

mock.module('../db/connection', () => ({
  db: {
    query: {
      studentCognitiveProfiles: {
        findFirst: mock(async () => {
          if (dbShouldThrow) throw new Error('DB error');
          return queryFindFirstResult;
        }),
      },
    },
    update: mock(() => ({
      set: mock(() => ({
        where: mock(async () => {
          if (dbWriteShouldThrow) throw new Error('DB write error');
          dbUpdateCalled = true;
          return {};
        }),
      })),
    })),
    insert: mock(() => ({
      values: mock(async () => {
        if (dbWriteShouldThrow) throw new Error('DB write error');
        dbInsertCalled = true;
        return {};
      }),
    })),
  },
}));

mock.module('../modules/tutor/cognitive-profile.schema', () => ({
  studentCognitiveProfiles: { userId: 'userId' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
}));

// Import after mocks
const { cognitiveProfileService } = await import('../modules/tutor/cognitive-profile.service');

beforeEach(() => {
  queryFindFirstResult = undefined;
  dbUpdateCalled = false;
  dbInsertCalled = false;
  dbShouldThrow = false;
  dbWriteShouldThrow = false;
});

describe('Cognitive Profile Service', () => {
  describe('getProfile', () => {
    it('should return profile when found', async () => {
      const profile = makeCognitiveProfile();
      queryFindFirstResult = profile;
      const result = await cognitiveProfileService.getProfile('user-001');
      expect(result).not.toBeNull();
      expect(result?.strengths).toEqual(['calcul mental', 'logique']);
    });

    it('should return null when not found', async () => {
      queryFindFirstResult = undefined;
      const result = await cognitiveProfileService.getProfile('user-new');
      expect(result).toBeNull();
    });

    it('should return null on DB error', async () => {
      dbShouldThrow = true;
      const result = await cognitiveProfileService.getProfile('user-err');
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getProfileSummary', () => {
    it('should format strengths/weaknesses/observations', async () => {
      queryFindFirstResult = makeCognitiveProfile();
      const summary = await cognitiveProfileService.getProfileSummary('user-001');
      expect(summary).not.toBeNull();
      expect(summary).toContain('Points forts');
      expect(summary).toContain('Points à travailler');
      expect(summary).toContain('Observations récentes');
    });

    it('should return null when no profile', async () => {
      queryFindFirstResult = undefined;
      const summary = await cognitiveProfileService.getProfileSummary('user-new');
      expect(summary).toBeNull();
    });

    it('should return null when profile has no data', async () => {
      queryFindFirstResult = makeCognitiveProfile({
        strengths: [],
        weaknesses: [],
        observations: [],
      });
      const summary = await cognitiveProfileService.getProfileSummary('user-empty');
      expect(summary).toBeNull();
    });

    it('should limit observations to last 3', async () => {
      queryFindFirstResult = makeCognitiveProfile({
        observations: Array.from({ length: 10 }, (_, i) => ({
          date: '2025-06-15',
          observation: `Obs ${i}`,
        })),
      });
      const summary = await cognitiveProfileService.getProfileSummary('user-001');
      expect(summary).not.toBeNull();
      // Should contain only last 3 observations
      const obsCount = (summary?.match(/- Obs/g) ?? []).length;
      expect(obsCount).toBe(3);
    });
  });

  describe('updateProfile', () => {
    it('should update existing profile', async () => {
      queryFindFirstResult = makeCognitiveProfile();
      await cognitiveProfileService.updateProfile('user-001', {
        strengths: ['calcul', 'algèbre'],
      });
      expect(dbUpdateCalled).toBe(true);
    });

    it('should append observation with cap at 50', async () => {
      queryFindFirstResult = makeCognitiveProfile({
        observations: Array.from({ length: 49 }, (_, i) => ({
          date: '2025-06-15',
          observation: `Obs ${i}`,
        })),
      });
      await cognitiveProfileService.updateProfile('user-001', {
        observation: 'New observation',
        subject: 'maths',
      });
      expect(dbUpdateCalled).toBe(true);
    });

    it('should create new profile when none exists', async () => {
      queryFindFirstResult = undefined;
      await cognitiveProfileService.updateProfile('user-new', {
        strengths: ['logique'],
        observation: 'First observation',
      });
      expect(dbInsertCalled).toBe(true);
    });

    it('rethrows a failed write, after logging it, so that no caller reports a success', async () => {
      queryFindFirstResult = makeCognitiveProfile();
      dbWriteShouldThrow = true;
      const outcome = await cognitiveProfileService.updateProfile('user-err', { strengths: ['test'] }).then(() => 'resolved', (error: unknown) => String(error));
      expect(outcome).toContain('DB write error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
