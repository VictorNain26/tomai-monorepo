import { describe, it, expect, afterAll } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import { checkDbReachable } from './_helpers/db';

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('answerDistress — from postgres', () => {
  const studentId = `distress_${Date.now()}`;

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(eq(user.id, studentId)).catch(() => null);
  });

  it('records the event once, closes the session, and keeps every message with the fixed reply', async () => {
    const { db } = await import('../db/connection');
    const { user, messages } = await import('../db/schema');
    const { studySessions } = await import('../modules/tutor/session.schema');
    const { distressEvents } = await import('../modules/tutor/distress.schema');
    const { answerDistress, closedForDistress } = await import('../modules/tutor/distress.service');
    const { DISTRESS_REPLY } = await import('../modules/tutor/distress');
    await db.insert(user).values({ id: studentId, email: `${studentId}@internal.tomai` });
    const [session] = await db.insert(studySessions).values({ userId: studentId }).returning({ id: studySessions.id });
    if (!session) throw new Error('session not created');

    await answerDistress({ turn: { kind: 'distress', sessionId: session.id, source: 'both', selfharmScore: 0.35 }, userId: studentId, content: "j'ai envie de disparaître" });
    expect(await closedForDistress(session.id)).toBe(true);
    await answerDistress({ turn: { kind: 'distress', sessionId: session.id, source: 'closed', selfharmScore: null }, userId: studentId, content: 'Tu es là ?' });

    const events = await db.select().from(distressEvents).where(eq(distressEvents.sessionId, session.id));
    expect(events.map((event) => [event.userId, event.detectedBy, event.selfharmScore?.toFixed(2)])).toEqual([[studentId, 'both', '0.35']]);
    const [closed] = await db.select().from(studySessions).where(eq(studySessions.id, session.id));
    expect(closed?.status).toBe('completed');
    expect(closed?.endedAt).not.toBeNull();
    // Saved within the same millisecond, the history still reads them in order.
    const stored = await db.select().from(messages).where(eq(messages.sessionId, session.id)).orderBy(asc(messages.createdAt));
    expect(stored.map((message) => [message.role, message.content, message.messageMetadata])).toEqual([
      ['user', "j'ai envie de disparaître", { distress: 'both' }],
      ['assistant', DISTRESS_REPLY, { distress: 'both' }],
      ['user', 'Tu es là ?', { distress: 'closed' }],
      ['assistant', DISTRESS_REPLY, { distress: 'closed' }],
    ]);
  });
});
