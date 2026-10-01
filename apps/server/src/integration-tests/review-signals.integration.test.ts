import { describe, it, expect, afterAll } from 'bun:test';
import { inArray, sql } from 'drizzle-orm';

async function checkDbReachable(): Promise<boolean> {
  try {
    const { db } = await import('../db/connection');
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('getReviewSignals — due cards and weak subjects from postgres', () => {
  const studentId = `review_${Date.now()}`;
  const otherId = `review_other_${Date.now()}`;

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(inArray(user.id, [studentId, otherId])).catch(() => null);
  });

  it("counts the student's due cards and ranks subjects by lapses", async () => {
    const { db } = await import('../db/connection');
    const { user, learningDecks, learningCards } = await import('../db/schema');
    const { getReviewSignals } = await import('../modules/learning/index');

    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const content = { front: 'q', back: 'r' };

    await db.insert(user).values([
      { id: studentId, email: `${studentId}@internal.tomai` },
      { id: otherId, email: `${otherId}@internal.tomai` },
    ]);
    const [maths, francais, otherDeck] = await db.insert(learningDecks).values([
      { userId: studentId, title: 'Fractions', subject: 'mathematiques', source: 'prompt' },
      { userId: studentId, title: 'Accords', subject: 'francais', source: 'prompt' },
      { userId: otherId, title: 'Fractions', subject: 'mathematiques', source: 'prompt' },
    ]).returning({ id: learningDecks.id });
    if (!maths || !francais || !otherDeck) throw new Error('decks not inserted');

    await db.insert(learningCards).values([
      { deckId: maths.id, cardType: 'flashcard', content, fsrsData: { due: past, lapses: 2 } },
      { deckId: maths.id, cardType: 'flashcard', content, fsrsData: { due: future, lapses: 0 } },
      { deckId: francais.id, cardType: 'flashcard', content, fsrsData: { due: future, lapses: 5 } },
      { deckId: otherDeck.id, cardType: 'flashcard', content, fsrsData: { due: past, lapses: 9 } },
    ]);

    expect(await getReviewSignals(studentId)).toEqual({
      dueCount: 1,
      weakSubjects: [
        { subject: 'francais', totalLapses: 5 },
        { subject: 'mathematiques', totalLapses: 2 },
      ],
    });
  });
});
