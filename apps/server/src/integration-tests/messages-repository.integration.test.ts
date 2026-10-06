import { describe, it, expect, afterAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { checkDbReachable } from './_helpers/db';

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('messagesRepository — stored model messages read for the replay window only, from postgres', () => {
  const studentId = `messages_${String(Date.now())}`;
  const modelMessages = [
    {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'raisonnement' },
        { type: 'text', text: 'Que fais-tu du +5 ?' },
      ],
    },
  ];

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db
      .delete(user)
      .where(eq(user.id, studentId))
      .catch(() => null);
  });

  it('leaves them out of the session history, and returns them for the asked messages', async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    const { studySessions } = await import('../modules/tutor/session.schema');
    const { messagesRepository } = await import('../modules/tutor/messages.repository');
    await db.insert(user).values({ id: studentId, email: `${studentId}@internal.tomai` });
    const [session] = await db.insert(studySessions).values({ userId: studentId }).returning({ id: studySessions.id });
    if (!session) throw new Error('session not created');
    await messagesRepository.create({ sessionId: session.id, role: 'user', content: 'Résous 3x + 5 = 20.' });
    const reply = await messagesRepository.create({ sessionId: session.id, role: 'assistant', content: 'Que fais-tu du +5 ?', modelMessages });

    const history = await messagesRepository.findBySessionId(session.id);
    expect(history.map((m) => m.content)).toEqual(['Résous 3x + 5 = 20.', 'Que fais-tu du +5 ?']);
    expect(history.every((m) => !('modelMessages' in m))).toBe(true);

    expect(await messagesRepository.findModelMessages([reply.id])).toEqual([{ id: reply.id, modelMessages }]);
    expect(await messagesRepository.findModelMessages([])).toEqual([]);
  });

  it("reads and counts the session's messages after a given one, all of them without one", async () => {
    const { db } = await import('../db/connection');
    const { studySessions } = await import('../modules/tutor/session.schema');
    const { messagesRepository } = await import('../modules/tutor/messages.repository');
    const [session] = await db.insert(studySessions).values({ userId: studentId }).returning({ id: studySessions.id });
    const [other] = await db.insert(studySessions).values({ userId: studentId }).returning({ id: studySessions.id });
    if (!session || !other) throw new Error('session not created');
    const created = [];
    for (const content of ['un', 'deux', 'trois', 'quatre'])
      created.push(await messagesRepository.create({ sessionId: session.id, role: 'user', content }));
    await messagesRepository.create({ sessionId: other.id, role: 'user', content: 'ailleurs' });

    expect((await messagesRepository.findAfter(session.id, created[1]?.id ?? null)).map((m) => m.content)).toEqual(['trois', 'quatre']);
    expect(await messagesRepository.countAfter(session.id, created[1]?.id ?? null)).toBe(2);
    expect((await messagesRepository.findAfter(session.id, null)).map((m) => m.content)).toEqual(['un', 'deux', 'trois', 'quatre']);
    expect(await messagesRepository.countAfter(session.id, null)).toBe(4);
    // A cutoff message gone: the whole session, not none of it.
    expect(await messagesRepository.countAfter(session.id, crypto.randomUUID())).toBe(4);
  });

  it('replaces a summary only where it still ends as read: a later run is not overwritten', async () => {
    const { db } = await import('../db/connection');
    const { studySessions } = await import('../modules/tutor/session.schema');
    const { studySessionsRepository } = await import('../modules/tutor/study-sessions.repository');
    const [session] = await db.insert(studySessions).values({ userId: studentId }).returning({ id: studySessions.id });
    if (!session) throw new Error('session not created');
    const [first, second] = [crypto.randomUUID(), crypto.randomUUID()];

    expect(await studySessionsRepository.replaceSummary(session.id, null, { conversationSummary: 'S1', summaryUpToMessageId: first })).toBe(true);
    expect(await studySessionsRepository.replaceSummary(session.id, first, { conversationSummary: 'S2', summaryUpToMessageId: second })).toBe(true);
    expect(await studySessionsRepository.replaceSummary(session.id, null, { conversationSummary: 'stale', summaryUpToMessageId: first })).toBe(false);
    const [row] = await db.select().from(studySessions).where(eq(studySessions.id, session.id));
    expect(row).toMatchObject({ conversationSummary: 'S2', summaryUpToMessageId: second });
  });
});
