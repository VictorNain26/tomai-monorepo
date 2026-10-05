import { describe, it, expect, afterAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { checkDbReachable } from './_helpers/db';

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('exerciseSheetsRepository.recordTurn — from postgres', () => {
  const studentId = `exercise_${Date.now()}`;

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(eq(user.id, studentId)).catch(() => null);
  });

  it('counts two turns of the same session at once, within the ladder, and ends then reopens the exercise', async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    const { studySessions } = await import('../modules/tutor/session.schema');
    await db.insert(user).values({ id: studentId, email: `${studentId}@internal.tomai` });
    const [session] = await db.insert(studySessions).values({ userId: studentId }).returning({ id: studySessions.id });
    if (!session) throw new Error('session not created');
    const { exerciseSheetsRepository } = await import('../modules/tutor/exercise-sheets.repository');
    const id = await exerciseSheetsRepository.create({ sessionId: session.id, sheet: null, uncertain: false, mathCheck: 'not-applicable', promptVersion: 'test' });
    if (!id) throw new Error('exercise not created');
    const wrong = (text: string) => ({ levelChange: 1, top: 4, stepDone: false, solved: false, hint: { level: 0, text } });

    await Promise.all([exerciseSheetsRepository.recordTurn(id, wrong('Premier')), exerciseSheetsRepository.recordTurn(id, wrong('Second'))]);
    let row = await exerciseSheetsRepository.findLatest(session.id);
    expect(row?.hintLevel).toBe(2);
    expect(row?.hints.map((hint) => hint.text).sort()).toEqual(['Premier', 'Second']);

    await exerciseSheetsRepository.recordTurn(id, { levelChange: 1, top: 2, stepDone: true, solved: true, hint: { level: 2, text: 'Bravo' } });
    row = await exerciseSheetsRepository.findLatest(session.id);
    expect(row).toMatchObject({ hintLevel: 2, stepsDone: 1 });
    expect(row?.solvedAt).not.toBeNull();

    await exerciseSheetsRepository.recordTurn(id, { levelChange: -5, top: 4, stepDone: false, solved: false, hint: { level: 0, text: 'Rouvert' } });
    row = await exerciseSheetsRepository.findLatest(session.id);
    expect(row).toMatchObject({ hintLevel: 0, solvedAt: null });
    expect(row?.hints).toHaveLength(4);
  });
});
