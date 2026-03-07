/**
 * Tests unitaires - Progress Service (services/progress.service.ts)
 * Focus: getStudentPerformance pure logic (improvementTrend, studyConsistency, engagementLevel)
 * Mock: repositories, DB, logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Repository mock state
let sessionsData: Array<Record<string, unknown>> = [];
let sessionStatsData = { totalSessions: 0, totalMinutes: 0, averageFrustration: 0 };
let progressSummaryData = { totalConcepts: 0, subjectProgress: [] };

mock.module('../db/repositories', () => ({
  studySessionsRepository: {
    getSessionStats: mock(async () => sessionStatsData),
    findByUserIdWithStats: mock(async () => sessionsData),
  },
  progressRepository: {
    getProgressSummary: mock(async () => progressSummaryData),
  },
}));

// DB mock for direct queries in getStudentStats
let dbSelectResults: unknown[][] = [];
let dbSelectIdx = 0;

mock.module('../db/connection', () => ({
  db: {
    selectDistinct: mock(() => ({
      from: mock(() => ({
        where: mock(() => {
          const r = dbSelectResults[dbSelectIdx] ?? [];
          dbSelectIdx++;
          return r;
        }),
      })),
    })),
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          orderBy: mock(() => ({
            limit: mock(() => {
              const r = dbSelectResults[dbSelectIdx] ?? [];
              dbSelectIdx++;
              return r;
            }),
          })),
          groupBy: mock(() => ({
            orderBy: mock(() => {
              const r = dbSelectResults[dbSelectIdx] ?? [];
              dbSelectIdx++;
              return r;
            }),
          })),
        })),
      })),
    })),
  },
}));

mock.module('../db/schema', () => ({
  studySessions: { userId: 'userId', subject: 'subject', startedAt: 'startedAt' },
  messages: { createdAt: 'createdAt', tokensUsed: 'tokensUsed' },
  costTracking: { id: 'id', createdAt: 'createdAt', tokensInput: 'tokensInput', tokensOutput: 'tokensOutput', costCents: 'costCents' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  count: (...args: unknown[]) => ({ type: 'count', args }),
  sum: (...args: unknown[]) => ({ type: 'sum', args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', strings, values }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
}));

// Import after mocks
const { progressService } = await import('../services/progress.service');

// Helper to create session data for findByUserIdWithStats mock
function makeSessionData(overrides: {
  id?: string;
  startedAt?: Date;
  messageCount?: number;
  frustrationAvg?: string;
  durationMinutes?: number;
}) {
  return {
    id: overrides.id ?? 'sess-1',
    subject: 'maths',
    startedAt: overrides.startedAt ?? new Date(),
    endedAt: null,
    messageCount: overrides.messageCount ?? 5,
    frustrationAvg: overrides.frustrationAvg ?? '2.0',
    durationMinutes: overrides.durationMinutes ?? 15,
  };
}

beforeEach(() => {
  sessionsData = [];
  sessionStatsData = { totalSessions: 0, totalMinutes: 0, averageFrustration: 0 };
  progressSummaryData = { totalConcepts: 0, subjectProgress: [] };
  dbSelectResults = [];
  dbSelectIdx = 0;
});

describe('Progress Service', () => {
  // ==================================================================
  // getStudentPerformance — pure logic on session data
  // ==================================================================
  describe('getStudentPerformance', () => {
    it('should return defaults for empty sessions', async () => {
      sessionsData = [];
      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.averageFrustration).toBe(0);
      expect(perf.totalMessagesExchanged).toBe(0);
      expect(perf.studyConsistency).toBe('Irregular');
      expect(perf.improvementTrend).toBe('Stable');
      expect(perf.engagementLevel).toBe('Low');
    });

    // ── improvementTrend ──────────────────────────────────────────

    it('should detect Improving trend (second half frustration < first half - 0.5)', async () => {
      const now = new Date();
      sessionsData = [
        // First half: high frustration (4.0)
        makeSessionData({ id: 's1', startedAt: new Date(now.getTime() - 6 * 24 * 3600000), frustrationAvg: '4.0' }),
        makeSessionData({ id: 's2', startedAt: new Date(now.getTime() - 5 * 24 * 3600000), frustrationAvg: '4.0' }),
        // Second half: low frustration (2.0) → diff = 2.0 > 0.5 → Improving
        makeSessionData({ id: 's3', startedAt: now, frustrationAvg: '2.0' }),
        makeSessionData({ id: 's4', startedAt: now, frustrationAvg: '2.0' }),
      ];

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.improvementTrend).toBe('Improving');
    });

    it('should detect Declining trend (second half frustration > first half + 0.5)', async () => {
      const now = new Date();
      sessionsData = [
        // First half: low frustration
        makeSessionData({ id: 's1', startedAt: new Date(now.getTime() - 6 * 24 * 3600000), frustrationAvg: '1.0' }),
        makeSessionData({ id: 's2', startedAt: new Date(now.getTime() - 5 * 24 * 3600000), frustrationAvg: '1.0' }),
        // Second half: high frustration → diff = 3.0 > 0.5 → Declining
        makeSessionData({ id: 's3', startedAt: now, frustrationAvg: '4.0' }),
        makeSessionData({ id: 's4', startedAt: now, frustrationAvg: '4.0' }),
      ];

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.improvementTrend).toBe('Declining');
    });

    it('should detect Stable trend (difference <= 0.5)', async () => {
      const now = new Date();
      sessionsData = [
        makeSessionData({ id: 's1', startedAt: new Date(now.getTime() - 3 * 24 * 3600000), frustrationAvg: '3.0' }),
        makeSessionData({ id: 's2', startedAt: new Date(now.getTime() - 2 * 24 * 3600000), frustrationAvg: '3.0' }),
        makeSessionData({ id: 's3', startedAt: now, frustrationAvg: '3.2' }),
        makeSessionData({ id: 's4', startedAt: now, frustrationAvg: '3.2' }),
      ];

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.improvementTrend).toBe('Stable');
    });

    // ── studyConsistency ──────────────────────────────────────────

    it('should return Excellent consistency (>= 5 sessions in last 7 days)', async () => {
      const now = new Date();
      sessionsData = Array.from({ length: 6 }, (_, i) =>
        makeSessionData({
          id: `s${i}`,
          startedAt: new Date(now.getTime() - i * 24 * 3600000), // 1 per day, last 6 days
          frustrationAvg: '2.0',
        })
      );

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.studyConsistency).toBe('Excellent');
    });

    it('should return Regular consistency (2-4 sessions in last 7 days)', async () => {
      const now = new Date();
      sessionsData = [
        makeSessionData({ id: 's1', startedAt: now, frustrationAvg: '2.0' }),
        makeSessionData({ id: 's2', startedAt: new Date(now.getTime() - 2 * 24 * 3600000), frustrationAvg: '2.0' }),
        makeSessionData({ id: 's3', startedAt: new Date(now.getTime() - 3 * 24 * 3600000), frustrationAvg: '2.0' }),
      ];

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.studyConsistency).toBe('Regular');
    });

    it('should return Irregular consistency (< 2 sessions in last 7 days)', async () => {
      const now = new Date();
      sessionsData = [
        // Only old sessions (> 7 days ago)
        makeSessionData({ id: 's1', startedAt: new Date(now.getTime() - 10 * 24 * 3600000), frustrationAvg: '2.0' }),
        makeSessionData({ id: 's2', startedAt: new Date(now.getTime() - 15 * 24 * 3600000), frustrationAvg: '2.0' }),
      ];

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.studyConsistency).toBe('Irregular');
    });

    // ── engagementLevel ───────────────────────────────────────────

    it('should return High engagement (avgDuration >= 20 AND totalMessages >= 50)', async () => {
      const now = new Date();
      sessionsData = [
        makeSessionData({ id: 's1', startedAt: now, durationMinutes: 25, messageCount: 30, frustrationAvg: '2.0' }),
        makeSessionData({ id: 's2', startedAt: now, durationMinutes: 25, messageCount: 30, frustrationAvg: '2.0' }),
      ];
      // avgDuration = 25, totalMessages = 60

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.engagementLevel).toBe('High');
    });

    it('should return Medium engagement (avgDuration >= 10 AND totalMessages >= 20)', async () => {
      const now = new Date();
      sessionsData = [
        makeSessionData({ id: 's1', startedAt: now, durationMinutes: 15, messageCount: 12, frustrationAvg: '2.0' }),
        makeSessionData({ id: 's2', startedAt: now, durationMinutes: 15, messageCount: 12, frustrationAvg: '2.0' }),
      ];
      // avgDuration = 15, totalMessages = 24

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.engagementLevel).toBe('Medium');
    });

    it('should return Low engagement (avgDuration < 10 OR totalMessages < 20)', async () => {
      const now = new Date();
      sessionsData = [
        makeSessionData({ id: 's1', startedAt: now, durationMinutes: 5, messageCount: 3, frustrationAvg: '2.0' }),
      ];
      // avgDuration = 5, totalMessages = 3

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.engagementLevel).toBe('Low');
    });

    it('should calculate correct averageFrustration and totalMessages', async () => {
      const now = new Date();
      sessionsData = [
        makeSessionData({ id: 's1', startedAt: now, frustrationAvg: '1.0', messageCount: 10 }),
        makeSessionData({ id: 's2', startedAt: now, frustrationAvg: '3.0', messageCount: 20 }),
        makeSessionData({ id: 's3', startedAt: now, frustrationAvg: '5.0', messageCount: 30 }),
      ];

      const perf = await progressService.getStudentPerformance('user-001');
      expect(perf.averageFrustration).toBe(3); // (1+3+5)/3
      expect(perf.totalMessagesExchanged).toBe(60); // 10+20+30
    });
  });

  // ==================================================================
  // getUserSessions — mapping from repository data
  // ==================================================================
  describe('getUserSessions', () => {
    it('should map repository fields correctly', async () => {
      const now = new Date();
      sessionsData = [{
        id: 'sess-1',
        subject: 'physique',
        startedAt: now,
        endedAt: null,
        messageCount: 12,
        frustrationAvg: '2.5',
        durationMinutes: 20,
      }];

      const sessions = await progressService.getUserSessions('user-001');
      expect(sessions.length).toBe(1);
      expect(sessions[0]?.subject).toBe('physique');
      expect(sessions[0]?.messagesCount).toBe(12);
      expect(sessions[0]?.avgFrustration).toBe(2.5);
      expect(sessions[0]?.durationMinutes).toBe(20);
    });

    it('should handle null frustrationAvg as 0', async () => {
      sessionsData = [{
        id: 'sess-1', subject: 'maths', startedAt: new Date(),
        endedAt: null, messageCount: 5, frustrationAvg: null, durationMinutes: 10,
      }];

      const sessions = await progressService.getUserSessions('user-001');
      expect(sessions[0]?.avgFrustration).toBe(0);
    });

    it('should handle null durationMinutes as 0', async () => {
      sessionsData = [{
        id: 'sess-1', subject: 'maths', startedAt: new Date(),
        endedAt: null, messageCount: 5, frustrationAvg: '2.0', durationMinutes: null,
      }];

      const sessions = await progressService.getUserSessions('user-001');
      expect(sessions[0]?.durationMinutes).toBe(0);
    });
  });
});
