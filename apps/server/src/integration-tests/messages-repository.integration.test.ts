import { describe, it, expect, afterAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { checkDbReachable } from './_helpers/db';

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('messagesRepository — stored model messages read for the replay window only, from postgres', () => {
  const studentId = `messages_${String(Date.now())}`;
  const modelMessages = [{ role: 'assistant', content: [{ type: 'reasoning', text: 'raisonnement' }, { type: 'text', text: 'Que fais-tu du +5 ?' }] }];

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(eq(user.id, studentId)).catch(() => null);
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
});
