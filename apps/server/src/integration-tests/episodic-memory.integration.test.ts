import { describe, it, expect, afterAll } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { checkDbReachable } from './_helpers/db';

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('episodicMemoryRepository.findRelevantEpisodes — scoped to the student, from postgres', () => {
  const stamp = Date.now();
  const studentId = `episodes_${stamp}`;
  const otherId = `episodes_other_${stamp}`;
  const embedding = Array.from({ length: 1024 }, () => 0.01);
  const day = 86_400_000;

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(inArray(user.id, [studentId, otherId])).catch(() => null);
  });

  it("returns the student's live episodes only, never another student's", async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    const { studySessions, sessionEpisodes } = await import('../modules/tutor/session.schema');
    await db.insert(user).values([studentId, otherId].map((id) => ({ id, email: `${id}@internal.tomai` })));
    // One insert per session: RETURNING does not promise the order of VALUES.
    const [own] = await db.insert(studySessions).values({ userId: studentId }).returning({ id: studySessions.id });
    const [other] = await db.insert(studySessions).values({ userId: otherId }).returning({ id: studySessions.id });
    if (!own || !other) throw new Error('sessions not created');
    const episode = (userId: string, sessionId: string, summaryText: string, ttlUntil: Date | null) => ({
      userId, sessionId, subject: 'mathematiques', summaryText, summaryEmbedding: embedding, ttlUntil,
    });
    // Production stores every episode with a TTL (90 days); a NULL one is the opt-out.
    await db.insert(sessionEpisodes).values([
      episode(studentId, own.id, 'own, live', new Date(stamp + day)),
      episode(studentId, own.id, 'own, no expiry', null),
      episode(studentId, own.id, 'own, expired', new Date(stamp - day)),
      episode(otherId, other.id, 'other, live', new Date(stamp + day)),
      episode(otherId, other.id, 'other, no expiry', null),
    ]);
    const { episodicMemoryRepository } = await import('../modules/tutor/episodic-memory.repository');

    const found = await episodicMemoryRepository.findRelevantEpisodes(studentId, `[${embedding.join(',')}]`, 10);

    expect(found.map((e) => e.summaryText).sort()).toEqual(['own, live', 'own, no expiry']);
  });
});
