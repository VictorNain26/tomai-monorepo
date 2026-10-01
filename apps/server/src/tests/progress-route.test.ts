import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/auth/session', () => {
  const signedIn = () => Promise.resolve({
    success: true as const,
    user: { id: 'student-1', role: 'student', firstName: 'Léa', schoolLevel: 'sixieme' },
    session: {},
  });
  return { requireAuth: signedIn, requireParentRole: signedIn };
});
mock.module('../modules/tutor/study-sessions.repository', () => ({
  studySessionsRepository: {
    getSessionStats: mock(async () => ({
      totalSessions: 4,
      totalMinutes: 90,
      averageFrustration: 1.5,
      subjectBreakdown: { mathematiques: 4 },
      lastSessionDate: null,
      studyDays: 3,
    })),
  },
}));
mock.module('../db/repositories', () => ({
  progressRepository: { getProgressSummary: mock(async () => ({ totalConcepts: 7, subjectProgress: [] })) },
}));

const { progressRoutes } = await import('../modules/tutor/progress.routes');

const app = new Hono<AppEnv>().route('/api', progressRoutes);

describe('GET /api/progress/dashboard', () => {
  it("returns the student's session stats", async () => {
    const res = await app.request('/api/progress/dashboard');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      student: { id: 'student-1', firstName: 'Léa', level: 'sixieme' },
      stats: { totalSessions: 4, totalStudyTime: 90, conceptsLearned: 7, averageFrustration: 1.5 },
    });
  });
});
