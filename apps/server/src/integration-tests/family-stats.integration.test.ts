import { describe, it, expect, afterAll } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { checkDbReachable } from './_helpers/db';

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('family children and study stats from postgres', () => {
  const stamp = Date.now();
  const parentId = `family_parent_${stamp}`;
  const activeId = `family_active_${stamp}`;
  const inactiveId = `family_inactive_${stamp}`;
  const ids = [parentId, activeId, inactiveId];

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(inArray(user.id, ids)).catch(() => null);
  });

  it('lists active children, and inactive ones on request', async () => {
    const { db } = await import('../db/connection');
    const { user, parentChild } = await import('../db/schema');
    const { listChildren } = await import('../modules/family/children');

    await db.insert(user).values(ids.map((id) => ({ id, email: `${id}@internal.tomai` })));
    await db.update(user).set({ isActive: false }).where(eq(user.id, inactiveId));
    await db.insert(parentChild).values([
      { parentUserId: parentId, childUserId: activeId },
      { parentUserId: parentId, childUserId: inactiveId },
    ]);

    expect((await listChildren(parentId)).map((c) => c.id)).toEqual([activeId]);
    expect((await listChildren(parentId, { includeInactive: true })).map((c) => c.id).sort()).toEqual([activeId, inactiveId].sort());
  });

  it('counts sessions, study days and the last session of a child', async () => {
    const { db } = await import('../db/connection');
    const { studySessions } = await import('../db/schema');
    const { getStudyStats } = await import('../modules/tutor/index');

    const day1 = new Date('2026-09-28T10:00:00Z');
    const day1Later = new Date('2026-09-28T11:00:00Z');
    const day2 = new Date('2026-09-30T10:00:00Z');
    await db.insert(studySessions).values([
      { userId: activeId, subject: 'mathematiques', startedAt: day1, durationMinutes: 20 },
      { userId: activeId, subject: 'mathematiques', startedAt: day1Later, durationMinutes: 10 },
      { userId: activeId, subject: 'francais', startedAt: day2, durationMinutes: 30 },
    ]);

    const stats = await getStudyStats(activeId);

    expect(stats).toMatchObject({
      totalSessions: 3,
      totalMinutes: 60,
      studyDays: 2,
      subjectBreakdown: { mathematiques: 2, francais: 1 },
    });
    expect(stats.lastSessionDate).toEqual(day2);
  });

  it('returns empty stats for a child without sessions', async () => {
    const { getStudyStats } = await import('../modules/tutor/index');

    expect(await getStudyStats(inactiveId)).toMatchObject({ totalSessions: 0, studyDays: 0, lastSessionDate: null });
  });
});
