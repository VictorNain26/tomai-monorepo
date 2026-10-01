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

describe.skipIf(!dbReachable)('learningService.getReviewSignals — due cards and weak subjects from postgres', () => {
  const stamp = Date.now();
  const studentId = `review_${stamp}`;
  const otherId = `review_other_${stamp}`;
  const emptyId = `review_empty_${stamp}`;
  const noLapseId = `review_nolapse_${stamp}`;
  const past = new Date(stamp - 86_400_000).toISOString();
  const future = new Date(stamp + 86_400_000).toISOString();
  const content = { front: 'q', back: 'r' };

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(inArray(user.id, [studentId, otherId, emptyId, noLapseId])).catch(() => null);
  });

  async function seed() {
    const { db } = await import('../db/connection');
    const { user, learningDecks, learningCards } = await import('../db/schema');

    await db.insert(user).values([studentId, otherId, emptyId, noLapseId].map((id) => ({ id, email: `${id}@internal.tomai` })));
    const decks = await db.insert(learningDecks).values(
      [
        [studentId, 'francais'],
        [studentId, 'mathematiques'],
        [studentId, 'histoire'],
        [studentId, 'svt'],
        [otherId, 'mathematiques'],
        [noLapseId, 'anglais'],
      ].map(([userId, subject]) => ({ userId: userId as string, subject: subject as string, title: 'Deck', source: 'prompt' as const })),
    ).returning({ id: learningDecks.id });
    const [francais, maths, histoire, svt, otherDeck, anglais] = decks.map((d) => d.id) as [string, string, string, string, string, string];

    await db.insert(learningCards).values([
      { deckId: francais, cardType: 'flashcard', content, fsrsData: { due: future, lapses: 5 } },
      { deckId: maths, cardType: 'flashcard', content, fsrsData: { due: past, lapses: 2 } },
      { deckId: maths, cardType: 'flashcard', content, fsrsData: { due: future, lapses: 1 } },
      { deckId: histoire, cardType: 'flashcard', content, fsrsData: { due: future, lapses: 2 } },
      { deckId: svt, cardType: 'flashcard', content, fsrsData: { due: future, lapses: 1 } },
      { deckId: otherDeck, cardType: 'flashcard', content, fsrsData: { due: past, lapses: 9 } },
      { deckId: anglais, cardType: 'flashcard', content, fsrsData: { due: past, lapses: 0 } },
    ]);
  }

  it("counts only the student's due cards and keeps the three subjects with the most lapses", async () => {
    await seed();
    const { learningService } = await import('../modules/learning/index');

    expect(await learningService.getReviewSignals(studentId)).toEqual({
      dueCount: 1,
      weakSubjects: [
        { subject: 'francais', totalLapses: 5 },
        { subject: 'mathematiques', totalLapses: 3 },
        { subject: 'histoire', totalLapses: 2 },
      ],
    });
  });

  it('leaves out a subject without lapses', async () => {
    const { learningService } = await import('../modules/learning/index');

    expect(await learningService.getReviewSignals(noLapseId)).toEqual({ dueCount: 1, weakSubjects: [] });
  });

  it('returns nothing for a student without cards', async () => {
    const { learningService } = await import('../modules/learning/index');

    expect(await learningService.getReviewSignals(emptyId)).toEqual({ dueCount: 0, weakSubjects: [] });
  });
});
