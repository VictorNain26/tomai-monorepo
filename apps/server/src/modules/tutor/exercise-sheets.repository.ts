import { desc, eq } from 'drizzle-orm';
import type { Hint } from './hint-ladder.js';
import { db } from '../../db/connection';
import { exerciseSheets } from './exercise-sheet.schema.js';

type NewExerciseSheet = typeof exerciseSheets.$inferInsert;
type StoredExerciseSheet = typeof exerciseSheets.$inferSelect;

class ExerciseSheetsRepository {
  async create(values: NewExerciseSheet): Promise<string | null> {
    const [row] = await db.insert(exerciseSheets).values(values).returning({ id: exerciseSheets.id });
    return row?.id ?? null;
  }

  /** The level after a turn, and the end of the exercise on a right final answer. */
  async updateProgress(id: string, progress: { hintLevel: number; solved: boolean }): Promise<void> {
    await db
      .update(exerciseSheets)
      .set({ hintLevel: progress.hintLevel, ...(progress.solved && { solvedAt: new Date() }) })
      .where(eq(exerciseSheets.id, id));
  }

  async setHints(id: string, hints: Hint[]): Promise<void> {
    await db.update(exerciseSheets).set({ hints }).where(eq(exerciseSheets.id, id));
  }

  /** The session's last exercise, solved or not. */
  async findLatest(sessionId: string): Promise<StoredExerciseSheet | null> {
    const [row] = await db
      .select()
      .from(exerciseSheets)
      .where(eq(exerciseSheets.sessionId, sessionId))
      .orderBy(desc(exerciseSheets.createdAt))
      .limit(1);
    return row ?? null;
  }
}

export const exerciseSheetsRepository = new ExerciseSheetsRepository();
