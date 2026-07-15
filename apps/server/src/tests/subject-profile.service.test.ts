// apps/server/src/tests/subject-profile.service.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test';

let store: Record<string, unknown> = {};
mock.module('../db/repositories/student-subject-profile.repository', () => ({
  studentSubjectProfileRepository: {
    upsertAggregate: mock(async (input: Record<string, unknown>) => { store = input; return store; }),
    findByUser: mock(async () => [
      { subject: 'mathematiques', conceptsSeen: ['fractions'], difficulties: ['signe -'], masteryNotes: null, sessionsCount: 2, updatedAt: new Date() },
    ]),
    findByUserAndSubject: mock(async () => ({ subject: 'mathematiques', conceptsSeen: ['fractions'], difficulties: ['signe -'], masteryNotes: null })),
    updateNotes: mock(async (_u: string, _s: string, p: Record<string, unknown>) => ({ subject: 'mathematiques', ...p })),
  },
}));

const { subjectProfileService } = await import('../services/chat/subject-profile.service');

beforeEach(() => { store = {}; });

describe('subjectProfileService', () => {
  it('skips aggregation for the general subject', async () => {
    await subjectProfileService.aggregateFromEpisode({ userId: 'u1', subject: 'general', conceptsCovered: ['x'] });
    expect(store).toEqual({});
  });
  it('aggregates concepts for a real subject', async () => {
    await subjectProfileService.aggregateFromEpisode({ userId: 'u1', subject: 'mathematiques', conceptsCovered: ['fractions'], outcome: 'completed' });
    expect((store as { subject?: string }).subject).toBe('mathematiques');
  });
  it('formats a compact memory block, null when subject is general', async () => {
    expect(await subjectProfileService.formatSubjectMemoryForPrompt('u1', 'general')).toBeNull();
    const block = await subjectProfileService.formatSubjectMemoryForPrompt('u1', 'mathematiques');
    expect(block).toContain('<subject_memory>');
    expect(block).toContain('fractions');
  });
});
