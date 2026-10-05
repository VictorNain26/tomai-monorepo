import { describe, it, expect, afterAll } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { checkDbReachable } from './_helpers/db';

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('learningService.getDueSummaryForUser — due cards from postgres', () => {
  const stamp = Date.now();
  const studentId = `review_${stamp}`;
  const otherId = `review_other_${stamp}`;
  const emptyId = `review_empty_${stamp}`;
  const past = new Date(stamp - 86_400_000).toISOString();
  const future = new Date(stamp + 86_400_000).toISOString();
  const content = { front: 'q', back: 'r' };

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(inArray(user.id, [studentId, otherId, emptyId])).catch(() => null);
  });

  it("counts only the student's due cards, across their decks, and none without cards", async () => {
    const { db } = await import('../db/connection');
    const { user, learningDecks, learningCards } = await import('../db/schema');
    const { learningService } = await import('../modules/learning/index');
    await db.insert(user).values([studentId, otherId, emptyId].map((id) => ({ id, email: `${id}@internal.tomai` })));
    const decks = await db.insert(learningDecks).values(
      [studentId, studentId, otherId].map((userId) => ({ userId, subject: 'mathematiques', title: 'Deck', source: 'prompt' as const })),
    ).returning({ id: learningDecks.id });
    const [first, second, others] = decks.map((d) => d.id) as [string, string, string];
    await db.insert(learningCards).values([
      { deckId: first, cardType: 'flashcard', content, fsrsData: { due: past } },
      { deckId: first, cardType: 'flashcard', content, fsrsData: { due: future } },
      { deckId: second, cardType: 'flashcard', content, fsrsData: { due: past } },
      { deckId: others, cardType: 'flashcard', content, fsrsData: { due: past } },
    ]);

    expect(await learningService.getDueSummaryForUser(studentId)).toBe(2);
    expect(await learningService.getDueSummaryForUser(emptyId)).toBe(0);
  });
});
